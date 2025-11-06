"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Submission = {
  id: string;
  sessionId: string;
  problemId: string;
  userId: string;
  language: string;
  code: string;
  results: string; // JSON string
  passed: boolean;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export default function SubmissionsPage() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [show, setShow] = useState<Submission | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/submissions", { cache: "no-store" });
        if (res.status === 401) {
          setError("Please sign in to view submissions.");
        } else if (!res.ok) {
          setError((await res.text()) || "Failed to load submissions");
        } else {
          setSubs(await res.json());
        }
      } catch (e: any) {
        setError("Failed to load submissions");
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Submissions</h1>
        <Link href="/dashboard" className="text-sm underline">Back to Dashboard</Link>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2 border-b">Session</th>
                <th className="text-left p-2 border-b">Problem</th>
                <th className="text-left p-2 border-b">Language</th>
                <th className="text-left p-2 border-b">Attempts</th>
                <th className="text-left p-2 border-b">Passed</th>
                <th className="text-left p-2 border-b">Updated</th>
                <th className="text-left p-2 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="p-2 border-b font-mono">{s.sessionId}</td>
                  <td className="p-2 border-b">{s.problemId}</td>
                  <td className="p-2 border-b">{s.language}</td>
                  <td className="p-2 border-b">{s.attempts}</td>
                  <td className="p-2 border-b">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.passed ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="p-2 border-b">{fmtDate(s.updatedAt)}</td>
                  <td className="p-2 border-b">
                    <button className="px-3 py-1 text-sm border rounded" onClick={() => setShow(s)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <DetailsModal sub={show} onClose={() => setShow(null)} />
      )}
    </div>
  );
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function DetailsModal({ sub, onClose }: { sub: Submission, onClose: () => void }) {
  const results = useMemo(() => { try { return JSON.parse(sub.results || '[]'); } catch { return []; } }, [sub.results]);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Submission Details</h2>
          <button className="border rounded px-2 py-1" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-gray-600">Meta</div>
            <div className="text-sm">Session: <span className="font-mono">{sub.sessionId}</span></div>
            <div className="text-sm">Problem: {sub.problemId}</div>
            <div className="text-sm">Language: {sub.language}</div>
            <div className="text-sm">Attempts: {sub.attempts}</div>
            <div className="text-sm">Passed: {sub.passed ? 'Yes' : 'No'}</div>
            <div className="text-sm">Updated: {fmtDate(sub.updatedAt)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Code</div>
            <pre className="border rounded p-2 bg-gray-50 max-h-64 overflow-auto text-xs whitespace-pre-wrap">{sub.code}</pre>
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-2">Per-case results</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(results || []).map((r: any, idx: number) => {
              const pass = !!r?.pass && !r?.error;
              return (
                <div key={idx} className={`border-2 rounded p-2 ${pass ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="text-xs font-semibold mb-1">Test case {idx + 1}</div>
                  {r?.error ? (
                    <div className="text-red-600 text-xs">{String(r.error)}</div>
                  ) : (
                    <div className="text-xs space-y-1">
                      {'got' in r && <div><span className="font-mono">got:</span> {toStr(r.got)}</div>}
                      {'exp' in r && <div><span className="font-mono">exp:</span> {toStr(r.exp)}</div>}
                      <div className={pass ? 'text-green-600' : 'text-red-600'}>{pass ? 'PASS' : 'FAIL'}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function toStr(v: any) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }
