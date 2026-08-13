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
  results: string; 
  passed: boolean;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  interviewerNotes?: string | null;
};

export default function SubmissionsPage() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [show, setShow] = useState<Submission | null>(null);
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);

  const handleView = async (sub: Submission) => {
    setLoadingDetailsId(sub.id);
    setError("");
    try {
      const res = await fetch(`/api/submissions?id=${sub.id}`, { cache: "no-store" });
      if (res.ok) {
        const fullSub = await res.json();
        setShow(fullSub);
      } else {
        setError("Failed to load submission details");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load submission details");
    } finally {
      setLoadingDetailsId(null);
    }
  };

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
                    <button
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                      onClick={() => handleView(s)}
                      disabled={loadingDetailsId === s.id}
                    >
                      {loadingDetailsId === s.id ? "Loading..." : "View"}
                    </button>
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-4xl p-6 space-y-4 text-gray-900 dark:text-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Submission Details</h2>
          <button className="border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded text-sm transition" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Meta</div>
            <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <div>Session: <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded">{sub.sessionId}</span></div>
              <div>Problem: <span className="font-semibold">{sub.problemId}</span></div>
              <div>Language: <span className="capitalize">{sub.language}</span></div>
              <div>Attempts: {sub.attempts}</div>
              <div>Passed: <span className={sub.passed ? "text-green-600 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>{sub.passed ? 'Yes' : 'No'}</span></div>
              <div>Updated: {fmtDate(sub.updatedAt)}</div>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Code</div>
            <pre className="border border-gray-200 dark:border-zinc-700 rounded p-2.5 bg-gray-50 dark:bg-zinc-950 text-gray-800 dark:text-zinc-200 max-h-64 overflow-auto text-xs whitespace-pre-wrap font-mono">{sub.code}</pre>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Per-case results</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(results || []).map((r: any, idx: number) => {
              const pass = !!r?.pass && !r?.error;
              return (
                <div key={idx} className={`border-2 rounded p-2.5 ${pass ? 'border-green-500 dark:border-green-700 bg-green-500/5' : 'border-red-500 dark:border-red-700 bg-red-500/5'}`}>
                  <div className="text-xs font-semibold mb-1 text-gray-900 dark:text-white">Test case {idx + 1}</div>
                  {r?.error ? (
                    <div className="text-red-600 dark:text-red-400 text-xs font-mono">{String(r.error)}</div>
                  ) : (
                    <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                      {'got' in r && <div><span className="font-mono text-gray-400">got:</span> {toStr(r.got)}</div>}
                      {'exp' in r && <div><span className="font-mono text-gray-400">exp:</span> {toStr(r.exp)}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {sub.interviewerNotes && (
          <div>
            <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Private Interviewer Notes</div>
            <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm whitespace-pre-wrap text-amber-900 dark:text-amber-200">
              {sub.interviewerNotes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toStr(v: any) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }
