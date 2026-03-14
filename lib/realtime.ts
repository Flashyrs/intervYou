import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type SignalPayload =
  | { type: "call-offer"; from: string; sessionId: string; sdp: any }
  | { type: "call-answer"; from: string; sessionId: string; sdp: any }
  | { type: "ice-candidate"; from: string; sessionId: string; candidate: any }
  | { type: "call-cancel"; from: string; sessionId: string }
  | { type: "random-invite"; from: string; tempId: string; initiatorId?: string }
  | { type: "random-accept"; from: string; tempId: string; sessionId: string };

/**
 * Send a signal payload on an ALREADY-SUBSCRIBED channel.
 *
 * WHY: supabase.channel(room) creates a NEW object every call, so calling
 * broadcast(room, ...) with a fresh channel always falls back to REST (the
 * channel was never subscribed). Instead, callers subscribe once via onSignal(),
 * store the returned channel, and pass it here directly.
 */
export function broadcast(ch: RealtimeChannel, payload: SignalPayload) {
  ch.send({
    type: "broadcast",
    event: "signal",
    payload,
  }).catch((error: unknown) => {
    console.error("[Realtime] Broadcast error:", error);
  });
}

/**
 * Subscribe to incoming signals on a new channel for the given room.
 * Returns the subscribed RealtimeChannel — store it and pass it to broadcast().
 * On cleanup, call the returned channel's .unsubscribe() method.
 */
export function onSignal(
  room: string,
  handler: (payload: SignalPayload) => void
): RealtimeChannel | null {
  if (!supabase) {
    console.warn("[Realtime] Supabase client not initialized");
    return null;
  }

  const ch = supabase.channel(room);

  ch.on("broadcast", { event: "signal" }, (msg: any) => {
    try {
      console.log(`[Signal Received] ${msg?.payload?.type} from ${msg?.payload?.from}`);
      handler(msg?.payload);
    } catch (error) {
      console.error("[Realtime] Signal handler error:", error);
    }
  });

  ch.subscribe((status: string) => {
    console.log(`[Realtime] Channel '${room}' status: ${status}`);
    if (status === "CHANNEL_ERROR") {
      console.error(`[Realtime] Failed to subscribe: ${room}`);
    } else if (status === "TIMED_OUT") {
      console.error(`[Realtime] Subscription timed out: ${room}`);
    }
  });

  return ch;
}
