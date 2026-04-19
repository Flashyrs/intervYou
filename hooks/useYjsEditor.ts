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
  const providerRef = useRef<YjsSupabaseProvider | null>(null);
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

    const provider = new YjsSupabaseProvider(roomName, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText("code");

    // Seed with initial code if the Y.Text is empty
    if (ytext.length === 0 && initialCode && initialCode !== "// Start coding...\n") {
      ytext.insert(0, initialCode);
    }

    // Listen for remote changes
    const observer = () => {
      if (isApplyingRemoteRef.current) return;
      const newCode = ytext.toString();
      if (newCode !== lastSyncedCodeRef.current) {
        lastSyncedCodeRef.current = newCode;
        onRemoteUpdate(newCode);
      }
    };
    ytext.observe(observer);

    return () => {
      ytext.unobserve(observer);
      bindingRef.current = null;
      provider.destroy();
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
