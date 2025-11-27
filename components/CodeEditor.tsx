"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CodeEditor() {
  const [code, setCode] = useState("// Start coding...\n");
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastServerCodeRef = useRef<string>("");
  const isLocalChangeRef = useRef(false);
  const pathname = usePathname();
  const sessionId = pathname?.split("/").pop();

  // Load initial state
  useEffect(() => {
    if (!sessionId) return;

    async function loadState() {
      try {
        const res = await fetch(`/api/interview/state?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.code) {
            lastServerCodeRef.current = data.code;
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

  // Save code changes to server (debounced)
  useEffect(() => {
    if (!sessionId || isLoading) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set flag to indicate this is a local change
    isLocalChangeRef.current = true;

    // Debounce save to avoid excessive API calls
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/interview/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, code }),
        });
        lastServerCodeRef.current = code;
      } catch (err) {
        console.error("Failed to save code:", err);
      }
    }, 500); // 500ms debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [code, sessionId, isLoading]);

  // Poll for changes from other participants
  useEffect(() => {
    if (!sessionId || isLoading) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/interview/state?sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.code && data.code !== lastServerCodeRef.current) {
            // Only update if this wasn't our own change
            if (!isLocalChangeRef.current) {
              lastServerCodeRef.current = data.code;
              setCode(data.code);
            }
          }
        }
        // Reset the local change flag after each poll
        isLocalChangeRef.current = false;
      } catch (err) {
        console.error("Failed to poll for updates:", err);
      }
    }, 1000); // Poll every 1 second

    return () => clearInterval(pollInterval);
  }, [sessionId, isLoading]);

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
        options={{ minimap: { enabled: false } }}
      />
      <textarea name="__monaco_value" className="hidden" defaultValue={code} readOnly />
    </div>
  );
}
