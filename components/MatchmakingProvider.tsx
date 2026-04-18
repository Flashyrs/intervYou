"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { presenceChannel } from "@/lib/presence";
import { useToast } from "@/components/Toast";
import { Users, X, PhoneCall } from "lucide-react";

interface MatchmakingContextProps {
  online: string[];
  incoming: any[];
  status: string;
  startRandom: () => void;
  acceptRandom: (invite: any) => void;
  declineRandom: (inviteId: string) => void;
}

const MatchmakingContext = createContext<MatchmakingContextProps>({
  online: [],
  incoming: [],
  status: "",
  startRandom: () => {},
  acceptRandom: () => {},
  declineRandom: () => {},
});

export function MatchmakingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();

  const [online, setOnline] = useState<string[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [tempId, setTempId] = useState<string | null>(null);
  const [lobbyReady, setLobbyReady] = useState(false);

  const presenceRef = useRef<any | null>(null);
  const channelRef = useRef<any | null>(null);
  const tempIdRef = useRef<string | null>(null);

  const userId = (session?.user as any)?.id as string | undefined;
  const userName = session?.user?.name;
  const userEmail = session?.user?.email;

  useEffect(() => {
    tempIdRef.current = tempId;
  }, [tempId]);

  // If user is inside an interview room, aggressively teardown presence and listening!
  const isInterviewing = pathname?.startsWith('/interview/');

  useEffect(() => {
    if (!supabase || isInterviewing) {
      if (channelRef.current) {
         supabase?.removeChannel(channelRef.current);
         channelRef.current = null;
      }
      return;
    }

    const ch = supabase.channel("random-call-lobby");
    channelRef.current = ch;

    ch.on("broadcast", { event: "lobby" }, (payload: any) => {
      const msg = payload?.payload;
      if (msg?.type === "random-invite") {
        if (msg.initiatorId && userId && msg.initiatorId === userId) return;
        setIncoming((prev) => {
          if (prev.find(p => p.initiatorId === msg.initiatorId)) return prev;
          return [...prev, { from: msg.from, tempId: msg.tempId, initiatorId: msg.initiatorId, name: msg.name }];
        });
      } else if (msg?.type === "random-accept") {
        if (tempIdRef.current && msg.tempId === tempIdRef.current && msg.sessionId) {
          push({ message: "Matched! Redirecting…", type: "success" });
          setStatus("Match Found! Joining...");
          router.push(`/interview/${msg.sessionId}`);
        }
      }
    });

    ch.subscribe((channelStatus) => {
      setLobbyReady(channelStatus === "SUBSCRIBED");
    });

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [router, userId, push, isInterviewing]);

  useEffect(() => {
    if (!supabase || !userId || isInterviewing) {
      if (presenceRef.current) {
        supabase?.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }
      setOnline([]);
      return;
    }

    const presenceKey = userEmail || userId;
    const pres = presenceChannel("presence-lobby", presenceKey);
    presenceRef.current = pres;

    const syncOnlineUsers = () => {
      const state = pres?.presenceState();
      const users = Object.values(state || {})
        .flatMap((arr: any) => arr.map((i: any) => i.name || i.email || i.userId))
        .filter((u: any) => u && u !== "undefined" && u !== "null");
      setOnline(Array.from(new Set(users)) as string[]);
    };

    pres?.on("presence", { event: "sync" }, syncOnlineUsers);
    pres?.on("presence", { event: "join" }, syncOnlineUsers);
    pres?.on("presence", { event: "leave" }, syncOnlineUsers);

    pres?.subscribe(async (presenceStatus: any) => {
      if (presenceStatus === "SUBSCRIBED") {
        try {
          await pres.track({ userId, name: userName, email: userEmail });
          syncOnlineUsers();
        } catch (error) {
          console.error("Presence track failed", error);
        }
      }
    });

    return () => {
      setOnline([]);
      if (presenceRef.current && supabase) {
        supabase.removeChannel(presenceRef.current);
        presenceRef.current = null;
      }
    };
  }, [userId, userName, userEmail, isInterviewing]);


  const startRandom = async () => {
    if (!session) return;
    if (!supabase) { push({ message: "Realtime not configured", type: "error" }); return; }
    if (!userId) { push({ message: "User ID missing. Try signing in again.", type: "error" }); return; }
    if (!lobbyReady) { push({ message: "Matchmaking is still connecting. Please try again in a moment.", type: "error" }); return; }

    setStatus("Looking for interviewer...");
    const id = Math.random().toString(36).slice(2, 10);
    setTempId(id);

    const payload = {
      type: "random-invite",
      from: "interviewee",
      tempId: id,
      initiatorId: userId,
      name: userName || "Unknown User"
    };

    channelRef.current?.send({ type: "broadcast", event: "lobby", payload }).catch(() => {
      push({ message: "Failed to broadcast invite", type: "error" });
      setStatus("");
    });
    
    // Auto-timeout if no one accepts
    setTimeout(() => {
       if (tempIdRef.current === id) {
          setStatus("");
          setTempId(null);
       }
    }, 15000);
  };

  const acceptingRef = useRef<Set<string>>(new Set());

  const acceptRandom = async (invite: any) => {
    if (!invite.tempId || acceptingRef.current.has(invite.tempId)) return;
    acceptingRef.current.add(invite.tempId);

    try {
      const res = await fetch("/api/random/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempId: invite.tempId, initiatorId: invite.initiatorId || "" }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setIncoming((prev) => prev.filter((p) => p.tempId !== invite.tempId));
        }
        push({ message: data?.error || "Accept failed", type: "error" });
        return;
      }

      const sessionId = data.sessionId;
      if (!lobbyReady) {
        push({ message: "Matchmaking channel is reconnecting. Please try accepting again.", type: "error" });
        return;
      }
      
      channelRef.current?.send({
        type: "broadcast",
        event: "lobby",
        payload: { type: "random-accept", from: "interviewer", tempId: invite.tempId, sessionId },
      }).catch(() => {
        push({ message: "Failed to confirm match", type: "error" });
        return;
      });
      
      setIncoming([]); // Clear all
      router.push(`/interview/${sessionId}`);
    } finally {
      acceptingRef.current.delete(invite.tempId);
    }
  };

  const declineRandom = (inviteId: string) => {
     setIncoming((prev) => prev.filter((p) => p.tempId !== inviteId));
  };

  // Skip showing global UI elements if we are actually ON the dashboard
  // since dashboard renders its own nice incoming request list.
  const isDashboard = pathname === '/dashboard';

  return (
    <MatchmakingContext.Provider value={{ online, incoming, status, startRandom, acceptRandom, declineRandom }}>
      {children}
      {/* Global incoming invites popup (if outside dashboard) */}
      {!isDashboard && incoming.length > 0 && !isInterviewing && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
          {incoming.map((req, i) => (
            <div key={i} className="bg-white border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
               <div className="bg-black px-4 py-3 flex items-center justify-between border-b border-gray-200">
                  <span className="text-white font-medium text-sm flex items-center gap-2">
                     <Users className="w-4 h-4" /> Incoming Code Match
                  </span>
                  <button onClick={() => declineRandom(req.tempId)} className="text-white/70 hover:text-white">
                     <X className="w-4 h-4" />
                  </button>
               </div>
               <div className="p-4 flex flex-col gap-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">
                     {req.name || req.initiatorId} is searching for a partner!
                  </p>
                  <div className="flex gap-2">
                     <button
                        onClick={() => acceptRandom(req)}
                        className="flex-1 bg-black hover:bg-gray-800 text-white text-xs font-semibold py-2 rounded flex items-center justify-center gap-2 transition"
                     >
                        <PhoneCall className="w-3.5 h-3.5" /> Accept Match
                     </button>
                     <button
                        onClick={() => declineRandom(req.tempId)}
                        className="px-3 border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold py-2 rounded transition"
                     >
                        Cancel
                     </button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </MatchmakingContext.Provider>
  );
}

export const useMatchmaking = () => useContext(MatchmakingContext);
