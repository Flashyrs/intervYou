"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { YjsSupabaseProvider } from "@/lib/YjsSupabaseProvider";
import { supabase } from "@/lib/supabase";

/**
 * Yjs hook for CRDT-based code synchronization.
 * 
 * Uses YjsSupabaseProvider for synchronization over Supabase Realtime.
 * This ensures high reliability without dependency on external signaling servers.
 */
export function useYjsEditor(
  sessionId: string,
  language: string,
  initialCode: string,
  onRemoteUpdate: (code: string) => void,
  editorSyncFallback: boolean,
) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<any | null>(null);
  const bindingRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const currentLanguageRef = useRef(language);
  const isApplyingRemoteRef = useRef(false);
  const lastSyncedCodeRef = useRef(initialCode);

  const controlChannelRef = useRef<any>(null);
  const triggerSupabaseFallbackRef = useRef<(() => void) | null>(null);

  // Track language changes
  currentLanguageRef.current = language;

  // Room name scoped per session + language
  const roomName = `${sessionId}-${language}`;

  // Initialize Yjs document and provider
  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    let provider: any = null;
    let destroyed = false;
    let controlChannel: any = null;

    const initProvider = async () => {
      // Set up control channel to coordinate WebRTC fallback desync
      if (supabase) {
        controlChannel = supabase.channel(`control-${roomName}`);
        controlChannelRef.current = controlChannel;
        controlChannel.on("broadcast", { event: "force-fallback" }, () => {
          if (destroyed) return;
          console.log("[useYjsEditor] Received force-fallback broadcast. Swapping to Supabase...");
          triggerSupabaseFallback();
        });
        controlChannel.subscribe();
      }

      const triggerSupabaseFallback = () => {
        if (providerRef.current instanceof YjsSupabaseProvider) return;

        console.log("[useYjsEditor] Swapping sync transport to Supabase Realtime...");
        if (providerRef.current && typeof providerRef.current.destroy === "function") {
          providerRef.current.destroy();
        }

        const supabaseProvider = new YjsSupabaseProvider(roomName, ydoc);
        providerRef.current = supabaseProvider;

        if (editorRef.current && (ydoc as any)._MonacoBindingClass) {
          const MonacoBinding = (ydoc as any)._MonacoBindingClass;
          if (bindingRef.current) bindingRef.current.destroy();
          bindingRef.current = new MonacoBinding(
            ydoc.getText("code"),
            editorRef.current.getModel(),
            new Set([editorRef.current]),
            supabaseProvider.awareness
          );
        }
      };

      triggerSupabaseFallbackRef.current = triggerSupabaseFallback;

      const startWebrtcOrSupabase = async () => {
        const signalingUrlsStr = process.env.NEXT_PUBLIC_WEBRTC_SIGNALING_URLS;
        const signalingUrls = signalingUrlsStr
          ? signalingUrlsStr.split(",").map(url => url.trim()).filter(Boolean)
          : [];

        if (signalingUrls.length === 0 || editorSyncFallback) {
          console.log(`[useYjsEditor] Suppressing WebRTC. Using Supabase Realtime primary sync.`);
          provider = new YjsSupabaseProvider(roomName, ydoc);
          providerRef.current = provider;
          return;
        }

        try {
          console.log(`[useYjsEditor] Initializing P2P WebRTC sync for room: ${roomName}...`);
          const { WebrtcProvider } = await import("y-webrtc");
          if (destroyed) return;

          provider = new WebrtcProvider(roomName, ydoc, {
            signaling: signalingUrls,
            peerOpts: {
              config: {
                iceServers: [
                  { urls: "stun:stun.l.google.com:19302" },
                  { urls: "stun:global.stun.twilio.com:3478" }
                ]
              }
            }
          });
          providerRef.current = provider;

        } catch (err) {
          console.error("[useYjsEditor] Failed to load WebRTC, falling back to Supabase Realtime:", err);
          if (destroyed) return;
          provider = new YjsSupabaseProvider(roomName, ydoc);
          providerRef.current = provider;
        }
      };

      await startWebrtcOrSupabase();

      const ytext = ydoc.getText("code");

      // Wait 1 second for peer/network synchronization to complete before inserting initial fallback code
      setTimeout(() => {
        if (destroyed) return;
        const currentYtext = ydoc.getText("code");
        if (currentYtext.length === 0 && initialCode && initialCode !== "// Start coding...\n") {
          ydoc.transact(() => {
            currentYtext.insert(0, initialCode);
          });
        }
      }, 1000);

      const observer = () => {
        if (isApplyingRemoteRef.current) return;
        const newCode = ytext.toString();
        if (newCode !== lastSyncedCodeRef.current) {
          lastSyncedCodeRef.current = newCode;
          onRemoteUpdate(newCode);
        }
      };
      ytext.observe(observer);
      (ydoc as any)._observer = observer;
    };

    initProvider();

    return () => {
      destroyed = true;
      const ytext = ydoc.getText("code");
      if ((ydoc as any)._observer) {
        ytext.unobserve((ydoc as any)._observer);
      }
      if (bindingRef.current && typeof bindingRef.current.destroy === "function") {
        bindingRef.current.destroy();
      }
      bindingRef.current = null;
      if (providerRef.current && typeof providerRef.current.destroy === "function") {
        providerRef.current.destroy();
      }
      if (controlChannel) {
        controlChannel.unsubscribe();
        if (supabase) {
          supabase.removeChannel(controlChannel);
        }
      }
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [roomName]); // Re-create when room (session+language) changes

  const forceSync = useCallback(() => {
    console.log("[useYjsEditor] Force fallback triggered by user...");
    if (controlChannelRef.current) {
      controlChannelRef.current.send({
        type: "broadcast",
        event: "force-fallback",
        payload: {}
      }).catch(console.error);
    }
    triggerSupabaseFallbackRef.current?.();
  }, []);

  useEffect(() => {
    if (editorSyncFallback) {
      console.log("[useYjsEditor] Persistent state fallback trigger received. Swapping to Supabase...");
      triggerSupabaseFallbackRef.current?.();
    }
  }, [editorSyncFallback]);

  // Bind Monaco editor to Yjs
  const bindEditor = useCallback(
    async (editor: any, monaco: any) => {
      editorRef.current = editor;

      if (!ydocRef.current || !providerRef.current) return;

      // Dynamically import y-monaco (it references browser APIs)
      const { MonacoBinding } = await import("y-monaco");
      if (ydocRef.current) {
        (ydocRef.current as any)._MonacoBindingClass = MonacoBinding;
      }

      // Clean up previous binding
      if (bindingRef.current) {
        bindingRef.current.destroy();
      }

      const model = editor.getModel();
      if (!model) {
        console.warn("Editor model not found, skipping binding");
        return;
      }

      const ydoc = ydocRef.current;
      const provider = providerRef.current;
      if (!ydoc || !provider) return;

      const ytext = ydoc.getText("code");

      bindingRef.current = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        provider.awareness
      );
    },
    [roomName]
  );

  // Apply local edits to Y.Doc (called from updateCode in useInterviewState)
  const applyLocalEdit = useCallback(
    (newCode: string) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const ytext = ydoc.getText("code");
      const currentYjsCode = ytext.toString();
      
      // Only update if the code actually differs (prevents feedback loops)
      if (currentYjsCode === newCode) return;
      
      isApplyingRemoteRef.current = true;
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newCode);
      });
      lastSyncedCodeRef.current = newCode;
      isApplyingRemoteRef.current = false;
    },
    []
  );

  // Get current Yjs code (for DB persistence)
  const getCurrentCode = useCallback(() => {
    if (!ydocRef.current) return initialCode;
    return ydocRef.current.getText("code").toString();
  }, [initialCode]);

  return {
    bindEditor,
    applyLocalEdit,
    getCurrentCode,
    forceSync,
    provider: providerRef,
    ydoc: ydocRef,
  };
}
