"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";

export default function LiveKitVideoCall({
  room,
  role,
}: {
  room: string;
  role: "interviewer" | "interviewee";
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function getToken() {
      try {
        const username = `${role}_${Math.floor(Math.random() * 1000)}`;
        const res = await fetch(`/api/livekit/token?room=${room}&username=${username}`);
        if (!res.ok) {
          throw new Error(`Token API failed with status ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          throw new Error(data.error);
        }
        setToken(data.token);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Failed to load LiveKit token");
      }
    }

    getToken();
    return () => {
      cancelled = true;
    };
  }, [room, role]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-900 text-white p-4 text-center rounded-xl border border-neutral-800">
        <div>
          <p className="text-red-500 font-semibold">LiveKit Connection Failed</p>
          <p className="text-xs text-neutral-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-900 text-white rounded-xl border border-neutral-800">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-neutral-400">Connecting to LiveKit server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-neutral-950 rounded-xl overflow-hidden relative border border-neutral-800 shadow-lg">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        connect={true}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
