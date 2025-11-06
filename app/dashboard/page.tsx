"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { presenceChannel } from "@/lib/presence";
import { useToast } from "@/components/Toast";

function InviteForm() {
  const { push } = useToast();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const send = async () => {
    if (!session) { signIn(); return; }
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        push({ message: data?.error || "Invite failed", type: "error" });
      } else {
        push({ message: "Invite sent", type: "success" });
        setEmail("");
      }
    } catch (e: any) {
      push({ message: "Invite failed", type: "error" });
    }
  };
  return (
    <div className="flex gap-2 items-center">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="flex-1 border rounded px-3 py-2" />
      <button className="px-3 py-2 bg-black text-white rounded" onClick={send}>Send</button>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [incoming, setIncoming] = useState<{ from: string; tempId: string; initiatorId?: string } | null>(null);
  const [status, setStatus] = useState<string>("");
  const [tempId, setTempId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const presenceRef = useRef<any>(null);
  const [online, setOnline] = useState<string[]>([]);
  const router = useRouter();
  const { push } = useToast();

  const userId = (session?.user as any)?.id as string | undefined;
  const displayName = session?.user?.name || session?.user?.email || "You";

  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("random-call-lobby");
    channelRef.current = ch;
    ch.on("broadcast", { event: "lobby" }, (payload: any) => {
      const msg = payload?.payload;
      if (msg?.type === "random-invite") {
        // Ignore invites we initiated ourselves
        if (msg.initiatorId && userId && msg.initiatorId === userId) return;
        setIncoming({ from: msg.from, tempId: msg.tempId, initiatorId: msg.initiatorId });
      } else if (msg?.type === "random-accept") {
        // If we are the initiator (we have the tempId), navigate as interviewee
        if (tempId && msg.tempId === tempId && msg.sessionId) {
          push({ message: "Matched! Redirecting…", type: "success" });
          router.push(`/interview/${msg.sessionId}`);
        }
      }
    });
    ch.subscribe();
    // Presence
    const pres = presenceChannel("presence-lobby");
    presenceRef.current = pres;
    pres?.on("presence", { event: "sync" }, () => {
      const state = pres?.presenceState();
      const users = Object.values(state || {}).flatMap((arr: any) => arr.map((i: any) => `${i.name || i.email || i.userId}`)).filter(Boolean);
      setOnline(Array.from(new Set(users)) as string[]);
    });
    pres?.subscribe(async (status: any) => {
      if (status === "SUBSCRIBED") {
        pres.track({ userId, name: session?.user?.name, email: session?.user?.email });
      }
    });

    return () => {
  supabase?.removeChannel(ch);
  supabase?.removeChannel(pres);
};

  }, [tempId, router, userId]);

  const startRandom = async () => {
    if (!session) {
      // Not signed in: redirect to sign-in
      signIn();
      return;
    }
    if (!supabase) { push({ message: "Realtime not configured", type: "error" }); return; }
    setStatus("Looking for interviewer...");
    const id = Math.random().toString(36).slice(2, 10);
    setTempId(id);
    channelRef.current?.send({ type: "broadcast", event: "lobby", payload: { type: "random-invite", from: "interviewee", tempId: id, initiatorId: userId } });
  };

  const accept = async () => {
    if (!supabase || !incoming) return;
    if (!session) { signIn(); return; }
    // Create actual interview session on accept
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
    // Broadcast accept so initiator navigates
    channelRef.current?.send({ type: "broadcast", event: "lobby", payload: { type: "random-accept", from: "interviewer", tempId: incoming.tempId, sessionId } });
    setIncoming(null);
    router.push(`/interview/${sessionId}`);
  };

  if (authStatus === "loading") {
    return <div className="mx-auto max-w-3xl p-6 text-center text-gray-600">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md p-8 mt-10 border rounded bg-white">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="mt-2 text-gray-600">Sign in to start a random interview</p>
        <button className="mt-6 w-full px-4 py-2 bg-black text-white rounded" onClick={() => signIn("google")}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-black text-white rounded" onClick={startRandom}>Random Interview</button>
          {status && <span className="text-sm text-gray-600">{status}</span>}
        </div>
        <div className="text-sm text-gray-600">Online interviewers: {online.length}</div>
      </div>

      <div className="border rounded p-4 bg-white">
        <p className="font-medium mb-2">Invite by email</p>
        <InviteForm />
      </div>

      {online.length > 0 && (
        <div className="border rounded p-3 bg-white">
          <p className="font-medium mb-2">Online</p>
          <ul className="text-sm text-gray-700 list-disc pl-5">
            {online.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {incoming && (
        <div className="border rounded p-3 flex items-center justify-between bg-white">
          <div>
            <p className="font-medium">Incoming random call</p>
            <p className="text-sm text-gray-600">from: {incoming.from}</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-black text-white rounded" onClick={accept}>Accept</button>
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setIncoming(null)}>Reject</button>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-600">Invites you send will appear in your email; use the link to join.</p>
    </div>
  );
}
