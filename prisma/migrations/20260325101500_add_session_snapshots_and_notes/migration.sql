ALTER TABLE "InterviewSession"
ADD COLUMN "liveStateVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stateSnapshot" JSONB,
ADD COLUMN "finalState" JSONB,
ADD COLUMN "problemPack" JSONB,
ADD COLUMN "interviewerNotes" TEXT,
ADD COLUMN "stateSnapshotUpdatedAt" TIMESTAMP(3);
