"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { YjsSupabaseProvider } from "@/lib/YjsSupabaseProvider";

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
) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<any | null>(null);
  const bindingRef = useRef<any>(null);
  const editorRef = useRef<any>(null);
  const currentLanguageRef = useRef(language);
  const isApplyingRemoteRef = useRef(false);
  const lastSyncedCodeRef = useRef(initialCode);

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

    const initProvider = async () => {
      const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
      const enablePartyKit = process.env.NEXT_PUBLIC_ENABLE_PARTYKIT === "true";

      const startWebrtcOrSupabase = async () => {
        try {
          console.log(`[useYjsEditor] Initializing P2P WebRTC sync for room: ${roomName}...`);
          const { WebrtcProvider } = await import("y-webrtc");
          if (destroyed) return;

          provider = new WebrtcProvider(roomName, ydoc, {
            signaling: [
              "wss://signaling.yjs.dev",
              "wss://y-webrtc-signaling-eu.herokuapp.com",
              "wss://y-webrtc-signaling-us.herokuapp.com"
            ]
          });
          providerRef.current = provider;

          // Fallback Timer: if no peer connection exists after 4 seconds, migrate to Supabase
          setTimeout(() => {
            if (destroyed) return;
            const webrtcConnected = providerRef.current && 
                                    (providerRef.current.room?.webrtcConns?.size > 0);

            if (!webrtcConnected) {
              console.log("[useYjsEditor] P2P WebRTC peer not found. Falling back to Supabase Realtime...");
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
            }
          }, 4000);

        } catch (err) {
          console.error("[useYjsEditor] Failed to load WebRTC, falling back to Supabase Realtime:", err);
          if (destroyed) return;
          provider = new YjsSupabaseProvider(roomName, ydoc);
          providerRef.current = provider;
        }
      };

      if (enablePartyKit && host) {
        try {
          console.log(`[useYjsEditor] Initializing PartyKit sync for room: ${roomName}...`);
          const YPartyKitProvider = (await import("y-partykit/provider")).default;
          if (destroyed) return;
          provider = new YPartyKitProvider(host, roomName, ydoc);
          providerRef.current = provider;
        } catch (err) {
          console.error("[useYjsEditor] Failed to load PartyKit, falling back to WebRTC:", err);
          await startWebrtcOrSupabase();
        }
      } else {
        await startWebrtcOrSupabase();
      }

      const ytext = ydoc.getText("code");

      if (ytext.length === 0 && initialCode && initialCode !== "// Start coding...\n") {
        ytext.insert(0, initialCode);
      }

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
      bindingRef.current = null;
      if (providerRef.current && typeof providerRef.current.destroy === "function") {
        providerRef.current.destroy();
      }
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [roomName]); // Re-create when room (session+language) changes

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
    provider: providerRef,
    ydoc: ydocRef,
  };
}
