import * as Y from "yjs";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { fromUint8Array, toUint8Array } from "js-base64";
import * as awarenessProtocol from "y-protocols/awareness";

/**
 * A custom Yjs provider that uses Supabase Realtime Broadcast as the transport.
 * 
 * This replaces y-webrtc to eliminate dependency on public signaling servers.
 * It is highly reliable and handles reconnections automatically through Supabase.
 */
export class YjsSupabaseProvider {
  private channel: RealtimeChannel | null = null;
  private doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;

  constructor(roomName: string, doc: Y.Doc) {
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);

    if (!supabase) {
      console.error("[YjsSupabaseProvider] Supabase client not initialized");
      return;
    }

    this.channel = supabase.channel(`yjs-${roomName}`);

    // 1. Handle document updates
    this.channel.on("broadcast", { event: "update" }, ({ payload }) => {
      const update = toUint8Array(payload.update);
      Y.applyUpdate(this.doc, update, this);
    });

    // 2. Handle awareness updates (cursors, presence)
    this.channel.on("broadcast", { event: "awareness" }, ({ payload }) => {
      const update = toUint8Array(payload.update);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this);
    });

    // 3. Handle initial state sync (Protocol 1: Sync Step 1)
    this.channel.on("broadcast", { event: "sync-step-1" }, ({ payload }) => {
      const stateVector = toUint8Array(payload.stateVector);
      const update = Y.encodeStateAsUpdate(this.doc, stateVector);
      this.channel?.send({
        type: "broadcast",
        event: "sync-step-2",
        payload: { update: fromUint8Array(update) },
      });
    });

    this.channel.on("broadcast", { event: "sync-step-2" }, ({ payload }) => {
       const update = toUint8Array(payload.update);
       Y.applyUpdate(this.doc, update, this);
    });

    // Broadcast local doc updates
    this.doc.on("update", (update, origin) => {
      if (origin === this) return;
      this.channel?.send({
        type: "broadcast",
        event: "update",
        payload: { update: fromUint8Array(update) },
      });
    });

    // Broadcast local awareness updates
    this.awareness.on("update", ({ added, updated, removed }: { added: number[], updated: number[], removed: number[] }, origin: any) => {
      if (origin === this) return;
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
      this.channel?.send({
        type: "broadcast",
        event: "awareness",
        payload: { update: fromUint8Array(update) },
      });
    });

    this.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Request missing state from other peers
        const stateVector = Y.encodeStateVector(this.doc);
        this.channel?.send({
          type: "broadcast",
          event: "sync-step-1",
          payload: { stateVector: fromUint8Array(stateVector) },
        });
      }
    });
  }

  destroy() {
    this.channel?.unsubscribe();
    this.awareness.destroy();
  }
}
