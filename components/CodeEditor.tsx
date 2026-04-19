"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { MonacoBinding } from "y-monaco";

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CodeEditor() {
  const [code, setCode] = useState("// Start coding...\n");
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const sessionId = pathname?.split("/").pop();

  const editorRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  // Load initial state
  useEffect(() => {
    if (!sessionId) return;

    async function loadState() {
      try {
        const res = await fetch(`/api/interview/state?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.code) {
            setCode(data.code);
          }
        }
      } catch (err) {
        console.error("Failed to load initial state:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadState();
  }, [sessionId]);

  function handleEditorMount(editor: any, monaco: any) {
    editorRef.current = editor;

    if (!sessionId) return;

    if (!ydocRef.current) {
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // WebrtcProvider creates a peer-to-peer connection avoiding 10msg/sec supabase limit
        const provider = new WebrtcProvider(`intervyou-${sessionId}`, ydoc, {
            signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com'] 
        });
        providerRef.current = provider;

        const type = ydoc.getText("monaco");

        new MonacoBinding(type, editorRef.current.getModel(), new Set([editorRef.current]), provider.awareness);

        // Populate initially if type is empty but we have downloaded state
        if (type.length === 0 && code) {
          type.insert(0, code);
        }
    }
  }

  // Cleanup provider
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  }, []);

  // Save code changes to server (debounced)
  useEffect(() => {
    if (!sessionId || isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Still persist to DB to handle the case where both users disconnect
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/interview/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, code }),
        });
      } catch (err) {
        console.error("Failed to save code:", err);
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [code, sessionId, isLoading]);

  // Update hidden textarea for code execution
  useEffect(() => {
    const hidden = document.querySelector("textarea[name=__monaco_value]") as HTMLTextAreaElement | null;
    if (hidden) hidden.value = code;
  }, [code]);

  if (isLoading) {
    return (
      <div className="border rounded overflow-hidden flex items-center justify-center h-[60vh] bg-gray-50">
        <p className="text-gray-500">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="border rounded overflow-hidden">
      <MonacoEditor
        height="60vh"
        defaultLanguage="javascript"
        value={code}
        onChange={(v: string | undefined) => setCode(v || "")}
        onMount={handleEditorMount}
        options={{ minimap: { enabled: false } }}
      />
      <textarea name="__monaco_value" className="hidden" defaultValue={code} readOnly />
    </div>
  );
}
