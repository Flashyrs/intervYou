import { supabase } from "@/lib/supabase";

export type SignalPayload =
  | { type: "call-offer"; from: string; sessionId: string; sdp: any }
  | { type: "call-answer"; from: string; sessionId: string; sdp: any }
  | { type: "ice-candidate"; from: string; sessionId: string; candidate: any }
  | { type: "call-cancel"; from: string; sessionId: string }
  | { type: "random-invite"; from: string; tempId: string; initiatorId?: string }
  | { type: "random-accept"; from: string; tempId: string; sessionId: string };

export function getChannel(room: string) {
  if (!supabase) {
    console.warn("Supabase client not initialized");
    return null;
  }
  return supabase.channel(room);
}

export function broadcast(room: string, payload: SignalPayload) {
  const ch = getChannel(room);
  if (!ch) {
    console.warn("Cannot broadcast - channel not available");
    return;
  }
  
  ch.send({ 
    type: "broadcast", 
    event: "signal", 
    payload 
  }).catch((error) => {
    console.error("Broadcast error:", error);
  });
}

export function onSignal(room: string, handler: (payload: SignalPayload) => void) {
  const ch = getChannel(room);
  if (!ch) {
    console.warn("Cannot subscribe - channel not available");
    return null;
  }

  ch.on("broadcast", { event: "signal" }, (msg: any) => {
    try {
      handler(msg?.payload);
    } catch (error) {
      console.error("Signal handler error:", error);
    }
  });

  return ch;
}
