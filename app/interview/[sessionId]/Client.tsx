"use client";
import { useEffect, useState } from "react";
import { CodeEditor } from "@/components/CodeEditor";
import { ProblemPanel } from "@/components/ProblemPanel";

export default function InterviewClient({ sessionId }: { sessionId: string }) {
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState<string>("");

  async function runCode() {
    const source_code = (document.querySelector("textarea[name=__monaco_value]") as HTMLTextAreaElement)?.value || "";
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, source_code }),
    });
    const data = await res.json();
    setOutput(JSON.stringify(data, null, 2));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <ProblemPanel />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>javascript</option>
            <option>typescript</option>
            <option>python</option>
            <option>java</option>
            <option>cpp</option>
          </select>
          <button onClick={runCode} className="px-3 py-2 bg-black text-white rounded">Run</button>
        </div>
        <CodeEditor />
        <pre className="bg-gray-50 border rounded p-3 overflow-auto max-h-64 text-sm">{output}</pre>
      </div>
    </div>
  );
}
