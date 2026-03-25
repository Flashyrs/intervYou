import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

type JsonMap = Record<string, any>;

type StoredInterviewState = JsonMap & {
  __meta?: {
    version: number;
    fieldVersions: Record<string, number>;
    updatedAt: string;
  };
};

type UpdateStateArgs = {
  sessionId: string;
  userId: string;
  patch: JsonMap;
  baseVersion?: number;
};

const STATE_TTL_SECONDS = 60 * 60 * 24;
let durableStateColumnsAvailable: boolean | null = null;

function stateKey(sessionId: string) {
  return `session:${sessionId}:state`;
}

function getPatchFields(patch: JsonMap) {
  const fields: string[] = [];

  for (const key of Object.keys(patch)) {
    if (key === "codeMap" && patch.codeMap && typeof patch.codeMap === "object") {
      for (const lang of Object.keys(patch.codeMap)) fields.push(`codeMap.${lang}`);
      continue;
    }

    if (key === "driverMap" && patch.driverMap && typeof patch.driverMap === "object") {
      for (const lang of Object.keys(patch.driverMap)) fields.push(`driverMap.${lang}`);
      continue;
    }

    fields.push(key);
  }

  return fields;
}

function mergePatch(current: JsonMap, patch: JsonMap) {
  const next = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (key === "codeMap" && value && typeof value === "object") {
      next.codeMap = { ...(next.codeMap || {}), ...value };
      continue;
    }

    if (key === "driverMap" && value && typeof value === "object") {
      next.driverMap = { ...(next.driverMap || {}), ...value };
      continue;
    }

    next[key] = value;
  }

  return next;
}

function toResponseState(state: StoredInterviewState, interviewerNotes?: string | null) {
  const { __meta, ...rest } = state || {};
  return {
    ...rest,
    version: __meta?.version ?? 0,
    interviewerNotes: interviewerNotes ?? undefined,
  };
}

function buildProblemPack(state: JsonMap) {
  const hasPackData =
    typeof state.problemTitle === "string" ||
    typeof state.problemText === "string" ||
    typeof state.sampleTests === "string" ||
    typeof state.privateTests === "string" ||
    !!state.driverMap ||
    !!state.codeMap ||
    typeof state.problemId === "string";

  if (!hasPackData) return undefined;

  return {
    problemId: state.problemId ?? null,
    problemTitle: state.problemTitle ?? "",
    problemText: state.problemText ?? "",
    sampleTests: state.sampleTests ?? "",
    privateTests: state.privateTests ?? "",
    driverMap: state.driverMap ?? {},
    codeMap: state.codeMap ?? {},
  };
}

async function fetchSessionContext(sessionId: string) {
  return prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      createdBy: true,
    },
  });
}

function isMissingDurableStateColumns(error: any) {
  const message = String(error?.message || "");
  return message.includes("liveStateVersion") ||
    message.includes("stateSnapshot") ||
    message.includes("problemPack") ||
    message.includes("finalState") ||
    message.includes("interviewerNotes");
}

async function readDurableSessionState(sessionId: string) {
  if (durableStateColumnsAvailable === false) {
    return {
      liveStateVersion: 0,
      stateSnapshot: null as StoredInterviewState | null,
      interviewerNotes: null as string | null,
    };
  }

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "liveStateVersion", "stateSnapshot", "interviewerNotes"
       FROM "InterviewSession"
       WHERE "id" = $1
       LIMIT 1`,
      sessionId
    );
    durableStateColumnsAvailable = true;
    const row = rows?.[0];
    return {
      liveStateVersion: Number(row?.liveStateVersion || 0),
      stateSnapshot: (row?.stateSnapshot as StoredInterviewState | null) || null,
      interviewerNotes: (row?.interviewerNotes as string | null) || null,
    };
  } catch (error) {
    if (isMissingDurableStateColumns(error)) {
      durableStateColumnsAvailable = false;
      return {
        liveStateVersion: 0,
        stateSnapshot: null as StoredInterviewState | null,
        interviewerNotes: null as string | null,
      };
    }
    throw error;
  }
}

async function writeDurableSessionState(args: {
  sessionId: string;
  liveStateVersion?: number;
  stateSnapshot?: StoredInterviewState | null;
  problemPack?: JsonMap | undefined;
  interviewerNotes?: string | null;
  finalState?: StoredInterviewState | null;
}) {
  if (durableStateColumnsAvailable === false) return;

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "InterviewSession"
       SET "liveStateVersion" = COALESCE($1, "liveStateVersion"),
           "stateSnapshot" = COALESCE($2::jsonb, "stateSnapshot"),
           "problemPack" = COALESCE($3::jsonb, "problemPack"),
           "interviewerNotes" = COALESCE($4, "interviewerNotes"),
           "finalState" = COALESCE($5::jsonb, "finalState"),
           "stateSnapshotUpdatedAt" = $6
       WHERE "id" = $7`,
      args.liveStateVersion ?? null,
      args.stateSnapshot === undefined ? null : JSON.stringify(args.stateSnapshot),
      args.problemPack === undefined ? null : JSON.stringify(args.problemPack),
      args.interviewerNotes ?? null,
      args.finalState === undefined ? null : JSON.stringify(args.finalState),
      new Date(),
      args.sessionId
    );
    durableStateColumnsAvailable = true;
  } catch (error) {
    if (isMissingDurableStateColumns(error)) {
      durableStateColumnsAvailable = false;
      return;
    }
    throw error;
  }
}

async function safeReadRedisState(sessionId: string) {
  try {
    const raw = await redis.get(stateKey(sessionId));
    return raw ? (JSON.parse(raw) as StoredInterviewState) : null;
  } catch {
    return null;
  }
}

async function safeWriteRedisState(sessionId: string, state: StoredInterviewState) {
  try {
    await redis.set(stateKey(sessionId), JSON.stringify(state), "EX", STATE_TTL_SECONDS);
  } catch {
    // DB snapshot remains the degraded fallback source of truth.
  }
}

export async function getInterviewState(sessionId: string, userId: string) {
  const session = await fetchSessionContext(sessionId);
  if (!session) throw new Error("Session not found");
  const durableState = await readDurableSessionState(sessionId);

  let state = await safeReadRedisState(sessionId);

  if (!state && durableState.stateSnapshot) {
    state = durableState.stateSnapshot;
    await safeWriteRedisState(sessionId, state);
  }

  const isInterviewer = session.createdBy === userId;
  return {
    session,
    state: state || {
      __meta: {
        version: durableState.liveStateVersion || 0,
        fieldVersions: {},
        updatedAt: new Date().toISOString(),
      },
    },
    response: toResponseState(state || {}, isInterviewer ? durableState.interviewerNotes : undefined),
    isInterviewer,
  };
}

export async function updateInterviewState({
  sessionId,
  userId,
  patch,
  baseVersion,
}: UpdateStateArgs) {
  const session = await fetchSessionContext(sessionId);
  if (!session) throw new Error("Session not found");
  const durableState = await readDurableSessionState(sessionId);

  const current =
    (await safeReadRedisState(sessionId)) ||
    (durableState.stateSnapshot || {});

  const currentMeta = current.__meta || {
    version: durableState.liveStateVersion || 0,
    fieldVersions: {},
    updatedAt: new Date().toISOString(),
  };

  const patchFields = getPatchFields(patch);
  const staleField =
    typeof baseVersion === "number"
      ? patchFields.find((field) => (currentMeta.fieldVersions[field] || 0) > baseVersion)
      : undefined;

  const isInterviewer = session.createdBy === userId;
  const interviewerNotes =
    typeof patch.interviewerNotes === "string" && isInterviewer
      ? patch.interviewerNotes
      : durableState.interviewerNotes;

  const sharedPatch = { ...patch };
  delete sharedPatch.interviewerNotes;

  if (staleField) {
    return {
      ok: false as const,
      status: 409,
      staleField,
      response: toResponseState(current, isInterviewer ? interviewerNotes : undefined),
    };
  }

  const merged = mergePatch(current, sharedPatch);
  const nextVersion = patchFields.length > 0 ? currentMeta.version + 1 : currentMeta.version;
  const nextMeta = {
    version: nextVersion,
    fieldVersions: { ...currentMeta.fieldVersions },
    updatedAt: new Date().toISOString(),
  };

  for (const field of patchFields) nextMeta.fieldVersions[field] = nextVersion;

  const nextState: StoredInterviewState = {
    ...merged,
    __meta: nextMeta,
  };

  await safeWriteRedisState(sessionId, nextState);

  const { __meta, ...snapshot } = nextState;
  await writeDurableSessionState({
    sessionId,
    liveStateVersion: nextVersion,
    stateSnapshot: nextState,
    problemPack: buildProblemPack(snapshot),
    interviewerNotes: interviewerNotes ?? null,
  });

  return {
    ok: true as const,
    status: 200,
    response: toResponseState(nextState, isInterviewer ? interviewerNotes : undefined),
  };
}

export async function persistFinalInterviewState(sessionId: string) {
  const state = await safeReadRedisState(sessionId);

  await writeDurableSessionState({
    sessionId,
    finalState: state,
    stateSnapshot: state,
    liveStateVersion: state?.__meta?.version,
  });

  return state;
}

export async function getInterviewerNotesForSessions(
  userId: string,
  sessionIds: string[]
): Promise<Record<string, string>> {
  if (!sessionIds.length || durableStateColumnsAvailable === false) return {};

  try {
    const placeholders = sessionIds.map((_, idx) => `$${idx + 2}`).join(", ");
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "interviewerNotes"
       FROM "InterviewSession"
       WHERE "createdBy" = $1
         AND "id" IN (${placeholders})`,
      userId,
      ...sessionIds
    );
    durableStateColumnsAvailable = true;

    const map: Record<string, string> = {};
    for (const row of rows || []) {
      if (row?.id && row?.interviewerNotes) {
        map[String(row.id)] = String(row.interviewerNotes);
      }
    }
    return map;
  } catch (error) {
    if (isMissingDurableStateColumns(error)) {
      durableStateColumnsAvailable = false;
      return {};
    }
    throw error;
  }
}

export async function getInterviewerNotes(sessionId: string, userId: string) {
  const session = await fetchSessionContext(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.createdBy !== userId) throw new Error("Forbidden");

  const durableState = await readDurableSessionState(sessionId);
  return durableState.interviewerNotes || "";
}

export async function updateInterviewerNotes(sessionId: string, userId: string, notes: string) {
  const session = await fetchSessionContext(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.createdBy !== userId) throw new Error("Forbidden");

  await writeDurableSessionState({
    sessionId,
    interviewerNotes: notes,
  });

  return notes;
}
