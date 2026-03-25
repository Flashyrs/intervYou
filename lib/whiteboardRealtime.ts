import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type WhiteboardPayload =
  | { type: "whiteboard-init"; from: string; scene: any }
  | { type: "whiteboard-update"; from: string; scene: any }
  | { type: "whiteboard-pointer"; from: string; pointer: { x: number; y: number } }
  | { type: "whiteboard-clear"; from: string };

export function broadcastWhiteboard(ch: RealtimeChannel, payload: WhiteboardPayload) {
  ch.send({
    type: "broadcast",
    event: "whiteboard",
    payload,
  }).catch((error: unknown) => {
    console.error("[Whiteboard] Broadcast error:", error);
  });
}

export function onWhiteboardSignal(
  room: string,
  handler: (payload: WhiteboardPayload) => void
): RealtimeChannel | null {
  if (!supabase) {
    console.warn("[Whiteboard] Supabase client not initialized");
    return null;
  }

  const ch = supabase.channel(room);

  ch.on("broadcast", { event: "whiteboard" }, (msg: any) => {
    try {
      handler(msg?.payload);
    } catch (error) {
      console.error("[Whiteboard] Signal handler error:", error);
    }
  });

  ch.subscribe((status: string) => {
    if (status === "CHANNEL_ERROR") {
      console.error(`[Whiteboard] Failed to subscribe: ${room}`);
    } else if (status === "TIMED_OUT") {
      console.error(`[Whiteboard] Subscription timed out: ${room}`);
    }
  });

  return ch;
}
