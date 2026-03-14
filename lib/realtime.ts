import { supabase } from "@/lib/supabase";

export type SignalPayload =
  | { type: "call-offer"; from: string; sessionId: string; sdp: any }
  | { type: "call-answer"; from: string; sessionId: string; sdp: any }
  | { type: "ice-candidate"; from: string; sessionId: string; candidate: any }
  | { type: "call-cancel"; from: string; sessionId: string }
  | { type: "random-invite"; from: string; tempId: string; initiatorId?: string }
  | { type: "random-accept"; from: string; tempId: string; sessionId: string };

/**
 * Module-level registry of subscribed Supabase channel instances, keyed by room.
 *
 * WHY: supabase.channel(room) creates a NEW object every call. If broadcast() and
 * onSignal() each call supabase.channel(room), they get different objects. broadcast()
 * ends up sending on an unsubscribed channel, which causes Supabase to fall back to
 * REST (the warning: "Realtime send() is automatically falling back to REST API").
 * The receiving peer never gets the WebSocket message → WebRTC handshake never starts
 * → "connecting" forever.
 *
 * FIX: always return the same channel object per room. onSignal() creates and subscribes
 * it on first use; broadcast() reuses the already-subscribed instance.
 */
const channelRegistry = new Map<string, ReturnType<NonNullable<typeof supabase>["channel"]>>();

function getOrCreateChannel(room: string) {
  if (!supabase) {
    console.warn("[Realtime] Supabase client not initialized");
    return null;
  }

  if (channelRegistry.has(room)) {
    return channelRegistry.get(room)!;
  }

  const ch = supabase.channel(room);
  channelRegistry.set(room, ch);
  return ch;
}

/**
 * Remove a room's channel from the registry and unsubscribe it.
 * Call this on component unmount (replace channelRef.current.unsubscribe() with this).
 */
export function leaveChannel(room: string) {
  const ch = channelRegistry.get(room);
  if (ch) {
    ch.unsubscribe();
    channelRegistry.delete(room);
  }
}

/**
 * Broadcast a signaling payload on the shared, subscribed channel for this room.
 * Safe to call at any time — uses the same channel instance that onSignal() subscribed.
 */
export function broadcast(room: string, payload: SignalPayload) {
  const ch = getOrCreateChannel(room);
  if (!ch) {
    console.warn("[Realtime] Cannot broadcast - channel not available");
    return;
  }

  ch.send({
    type: "broadcast",
    event: "signal",
    payload,
  }).catch((error: unknown) => {
    console.error("[Realtime] Broadcast error:", error);
  });
}

/**
 * Subscribe to incoming signals on the shared channel for this room.
 * Returns the shared channel (keep a ref to it for cleanup via leaveChannel()).
 */
export function onSignal(room: string, handler: (payload: SignalPayload) => void) {
  const ch = getOrCreateChannel(room);
  if (!ch) {
    console.warn("[Realtime] Cannot subscribe - channel not available");
    return null;
  }

  const handleSignal = (msg: any) => {
    try {
      console.log(`[Signal Received] ${msg?.payload?.type} from ${msg?.payload?.from}`);
      handler(msg?.payload);
    } catch (error) {
      console.error("[Realtime] Signal handler error:", error);
    }
  };

  ch.on("broadcast", { event: "signal" }, handleSignal);

  // Subscribe only if not already joined/joining
  if (ch.state !== "joined" && ch.state !== "joining") {
    ch.subscribe((status: string) => {
      console.log(`[Realtime] Channel '${room}' status: ${status}`);
      if (status === "CHANNEL_ERROR") {
        console.error(`[Realtime] Failed to subscribe to channel: ${room}`);
      } else if (status === "TIMED_OUT") {
        console.error(`[Realtime] Subscription timed out for channel: ${room}`);
      }
    });
  }

  return ch;
}
