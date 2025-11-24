"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { presenceChannel } from "@/lib/presence";
import { useToast } from "@/components/Toast";
import { ScheduleModal } from "@/components/interview/ScheduleModal";



export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [incoming, setIncoming] = useState<{ from: string; tempId: string; initiatorId?: string; name?: string } | null>(null);
  const [status, setStatus] = useState<string>("");
  const [tempId, setTempId] = useState<string | null>(null);
  const channelRef = useRef<any | null>(null);
  const presenceRef = useRef<any | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  const userId = (session?.user as any)?.id as string | undefined;

  useEffect(() => {
    if (!supabase) return;

    const ch = supabase.channel("random-call-lobby");
    channelRef.current = ch;

    ch.on("broadcast", { event: "lobby" }, (payload: any) => {
      const msg = payload?.payload;
      if (msg?.type === "random-invite") {
        if (msg.initiatorId && userId && msg.initiatorId === userId) return;
        setIncoming({ from: msg.from, tempId: msg.tempId, initiatorId: msg.initiatorId, name: msg.name });
      } else if (msg?.type === "random-accept") {
        if (tempId && msg.tempId === tempId && msg.sessionId) {
          push({ message: "Matched! Redirecting…", type: "success" });
          router.push(`/interview/${msg.sessionId}`);
        }
      }
    });

    ch.subscribe();

    const pres = presenceChannel("presence-lobby");
    presenceRef.current = pres;

    pres?.on("presence", { event: "sync" }, () => {
      const state = pres?.presenceState();
      const users = Object.values(state || {})
        .flatMap((arr: any) => arr.map((i: any) => `${i.name || i.email || i.userId}`))
        .filter(Boolean);
      setOnline(Array.from(new Set(users)) as string[]);
    });

    pres?.subscribe((status: any) => {
      if (status === "SUBSCRIBED") {
        pres.track({ userId, name: session?.user?.name, email: session?.user?.email });
      }
    });

    return () => {
      if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
      if (presenceRef.current && supabase) supabase.removeChannel(presenceRef.current);
    };
  }, [tempId, router, userId, push, session]);

  const startRandom = async () => {
    if (!session) { signIn(); return; }
    if (!supabase) { push({ message: "Realtime not configured", type: "error" }); return; }

    if (!userId) {
      push({ message: "User ID missing. Please sign out and sign in again.", type: "error" });
      return;
    }

    setStatus("Looking for interviewer...");
    const id = Math.random().toString(36).slice(2, 10);
    setTempId(id);

    const payload = {
      type: "random-invite",
      from: "interviewee",
      tempId: id,
      initiatorId: userId,
      name: session.user?.name || "Unknown User"
    };

    channelRef.current?.send({
      type: "broadcast",
      event: "lobby",
      payload,
    });
  };

  const accept = async () => {
    if (!supabase || !incoming) return;
    if (!session) { signIn(); return; }

    const res = await fetch("/api/random/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempId: incoming.tempId, initiatorId: incoming.initiatorId || "" }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ message: data?.error || "Accept failed", type: "error" });
      return;
    }

    const sessionId = data.sessionId;
    channelRef.current?.send({
      type: "broadcast",
      event: "lobby",
      payload: { type: "random-accept", from: "interviewer", tempId: incoming.tempId, sessionId },
    });
    setIncoming(null);
    router.push(`/interview/${sessionId}`);
  };

  if (authStatus === "loading") return <div className="mx-auto max-w-3xl p-6 text-center text-gray-600">Loading…</div>;

  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 mt-10 border rounded bg-white">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-2 text-gray-600">Sign in to start a random interview</p>
        <button
          className="mt-6 w-full px-4 py-2 bg-black text-white rounded"
          onClick={() => signIn("google")}
        >
          Sign in with Google
        </button>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-3xl p-2 md:p-4 space-y-3 md:space-y-4">
      {}
      {incoming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Random Interview Request</h2>
            <p className="text-gray-700 mb-6">
              <span className="font-medium">{incoming.name || "A user"}</span> is looking for an interviewer.
              Would you like to accept this random interview?
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
                onClick={accept}
              >
                Accept
              </button>
              <button
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
                onClick={() => setIncoming(null)}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-xl md:text-2xl font-semibold">Dashboard</h1>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-3">
        <div className="flex items-center gap-3">
          <button className="px-3 md:px-4 py-2 bg-black text-white rounded text-sm md:text-base" onClick={startRandom}>
            Random Interview
          </button>
          {status && <span className="text-xs md:text-sm text-gray-600">{status}</span>}
        </div>
        <div className="text-xs md:text-sm text-gray-600">Online interviewers: {online.length}</div>
      </div>

      {}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={(sessionId, link) => {
            setShowScheduleModal(false);
            router.push(link);
          }}
        />
      )}

      <div className="border rounded p-4 bg-white">
        <p className="font-medium mb-2">Invite by email</p>
        <button
          className="w-full px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition"
          onClick={() => {
            if (!session) {
              signIn();
              return;
            }
            setShowScheduleModal(true);
          }}
        >
          Schedule Interview
        </button>
      </div>

      {online.length > 0 && (
        <div className="border rounded p-3 bg-white">
          <p className="font-medium mb-2">Online</p>
          <ul className="text-sm text-gray-700 list-disc pl-5">
            {online.map((o) => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
