import { supabase } from "@/lib/supabase";

export type SignalPayload =
  | { type: "call-offer"; from: string; sessionId: string; sdp: any }
  | { type: "call-answer"; from: string; sessionId: string; sdp: any }
  | { type: "ice-candidate"; from: string; sessionId: string; candidate: any }
  | { type: "call-cancel"; from: string; sessionId: string }
  | { type: "random-invite"; from: string; tempId: string }
  | { type: "random-accept"; from: string; tempId: string; sessionId: string };

export function getChannel(room: string) {
  if (!supabase) return null;
  return supabase.channel(room);
}

export function broadcast(room: string, payload: SignalPayload) {
  const ch = getChannel(room);
  ch?.send({ type: "broadcast", event: "signal", payload });
}

export function onSignal(room: string, handler: (payload: SignalPayload) => void) {
  const ch = getChannel(room);
  ch?.on("broadcast", { event: "signal" }, (msg: any) => {
    handler(msg?.payload);
  });
  return ch;
}
