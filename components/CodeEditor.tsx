"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export function CodeEditor() {
  const [code, setCode] = useState("// Start coding...\n");

  useEffect(() => {
    const hidden = document.querySelector("textarea[name=__monaco_value]") as HTMLTextAreaElement | null;
    if (hidden) hidden.value = code;
  }, [code]);

  return (
    <div className="border rounded overflow-hidden">
      <MonacoEditor height="60vh" defaultLanguage="javascript" value={code} onChange={(v: string | undefined) => setCode(v || "")} options={{ minimap: { enabled: false } }} />
      <textarea name="__monaco_value" className="hidden" defaultValue={code} readOnly />
    </div>
  );
}
