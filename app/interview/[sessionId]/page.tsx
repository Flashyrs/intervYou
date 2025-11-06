"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";
import VideoCall from "@/components/VideoCall";
import { signIn } from "next-auth/react";

const MonacoEditor: any = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const allowedLangs = [
  { id: "javascript", name: "JavaScript" },
  { id: "java", name: "Java" },
  { id: "cpp", name: "C++" },
];

function AuthModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">Sign in to join interview</h2>
        <p className="text-sm text-gray-600">You need to sign in with Google to access this interview session.</p>
        <div className="flex gap-2 justify-end">
          <button className="px-3 py-2 rounded border" onClick={onClose}>Close</button>
          <button className="px-3 py-2 rounded bg-black text-white" onClick={() => signIn("google")}>Sign in with Google</button>
        </div>
      </div>
    </div>
  );
}

function RunSummary({ results, sampleText }: { results: any[], sampleText: string }) {
  const total = results?.length || 0;
  const passed = (results || []).filter((r: any) => r && r.pass && !r.error).length;
  if (total === 0) return null;
  const allPass = passed === total;
  return (
    <div className={`rounded border p-2 text-sm ${allPass ? 'border-green-500 bg-green-50 text-green-800' : 'border-yellow-500 bg-yellow-50 text-yellow-800'}`}>
      {allPass ? 'All test cases passed' : 'Some test cases failed'}
      <span className="ml-2">({passed}/{total} passed)</span>
    </div>
  );
}

function renderCaseCards(results: any[], role: 'interviewer'|'interviewee', sampleText: string) {
  const sampleCount = (() => { try { return JSON.parse(sampleText || '[]').length; } catch { return 0; } })();
  return (results || []).map((r, idx) => {
    const isPrivate = idx >= sampleCount;
    const pass = !!r?.pass && !r?.error;
    const border = pass ? 'border-green-500' : 'border-red-500';
    const locked = isPrivate && role === 'interviewee';
    return (
      <div key={idx} className={`border-2 rounded p-3 ${border}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Test case {idx + 1}</div>
          {isPrivate ? (
            <span title="Private test" className="text-xs px-2 py-0.5 rounded bg-gray-100 border">🔒 Private</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-green-50 border">Sample</span>
          )}
        </div>
        {locked ? (
          <div className="text-gray-500 text-sm italic">Hidden</div>
        ) : (
          <div className="text-sm space-y-1">
            {r?.error ? (
              <div className="text-red-600">{String(r.error)}</div>
            ) : (
              <>
                {'got' in r && <div><span className="font-mono">got:</span> {stringifyCompact(r.got)}</div>}
                {'exp' in r && <div><span className="font-mono">exp:</span> {stringifyCompact(r.exp)}</div>}
                <div className={pass ? 'text-green-600' : 'text-red-600'}>{pass ? 'PASS' : 'FAIL'}</div>
              </>
            )}
          </div>
        )}
      </div>
    );
  });
}

function stringifyCompact(v: any) { 
  try { 
    return typeof v === 'string' ? v : JSON.stringify(v); 
  } catch { 
    return String(v); 
  } 
}

function prettyResult(out: any) {
  const s = out?.stdout || out?.compile_output || out?.message || "";
  if (!s) return JSON.stringify(out, null, 2);
  return typeof s === 'string' ? s : JSON.stringify(s, null, 2);
}

function buildHarness(language: string, userCode: string, driver: string, tests: any[]) {
  switch ((language || '').toLowerCase()) {
    case 'javascript':
      return buildJS(userCode, driver, tests);
    case 'java':
      return buildJava(userCode, driver, tests);
    case 'cpp':
      return buildCpp(userCode, driver, tests);
    default:
      return userCode;
  }
}

function safeJSON(v: any) { 
  try { 
    return JSON.stringify(v); 
  } catch { 
    return 'null'; 
  } 
}

function buildJS(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  const drv = driver || `function runTests() { return []; }`;
  return `"use strict";\n${userCode}\n\n${drv}\n\n(function(){\n  const results = [];\n  const tests = ${testStr};\n  try {\n    if (typeof runTests === 'function') {\n      const r = runTests(tests) || [];\n      if (Array.isArray(r)) { for (const x of r) results.push(x); } else { results.push(r); }\n    } else if (typeof solve === 'function') {\n      for (const t of tests) {\n        const inp = t.input;\n        const exp = t.output;\n        const got = Array.isArray(inp) ? solve(...inp) : solve(inp);\n        results.push({ got, exp, pass: JSON.stringify(got)===JSON.stringify(exp) });\n      }\n    } else {\n      results.push({ error: 'No solve() or runTests() defined' });\n    }\n  } catch (e) {\n    results.push({ error: String(e&&e.message||e) });\n  }\n  console.log(JSON.stringify(results));\n})();`;
}

function buildJava(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  const drv = (driver && driver.trim().length)
    ? driver
    : `// Provide either runTests(List<Map<String,Object>> tests) or solve(...)
import java.util.*;
class Driver {
  public static List<String> runTests(List<Map<String,Object>> tests) {
    List<String> out = new ArrayList<>();
    try {
      // If user implemented solve, try to invoke reflectively assumptions kept simple for primitives/arrays
      out.add("No driver provided; implement runTests or ensure solve(...) exists.");
    } catch (Exception e) {
      out.add("Error: "+e.getMessage());
    }
    return out;
  }
}`;

  return `import java.io.*;\nimport java.util.*;\nclass Solution {\n${userCode}\n}\n${drv}\nclass Main {\n  public static void main(String[] args) throws Exception {\n    List<Map<String,Object>> tests = new ArrayList<>();\n    String json = "${testStr.replace(/"/g, '\\"')}";\n    tests = parseTests(json);\n    List<Map<String,Object>> results = new ArrayList<>();\n    try {\n      List<String> lines = null;\n      try {\n        lines = Driver.runTests(tests);\n      } catch (Throwable ignore) { }\n      if (lines != null) {\n        for (String s: lines) { System.out.println(s); }\n        return;\n      } else {\n        for (int i = 0; i < tests.size(); i++) {\n          Map<String,Object> r = new LinkedHashMap<>();\n          r.put("error", "No driver provided; implement Driver.runTests");\n          r.put("pass", false);\n          results.add(r);\n        }\n      }\n    } catch (Throwable t) {\n      Map<String,Object> r = new LinkedHashMap<>();\n      r.put("error", "Driver error: "+t.getMessage());\n      r.put("pass", false);\n      results.add(r);\n    }\n    System.out.println(toJson(results));\n  }\n  static String toJson(List<Map<String,Object>> list){\n    StringBuilder sb = new StringBuilder();\n    sb.append("[");\n    for (int i=0;i<list.size();i++){ if (i>0) sb.append(","); sb.append(objToJson(list.get(i))); }\n    sb.append("]");\n    return sb.toString();\n  }\n  static String objToJson(Map<String,Object> m){\n    StringBuilder sb = new StringBuilder(); sb.append("{"); boolean first=true;\n    for (Map.Entry<String,Object> e: m.entrySet()){ if (!first) sb.append(","); first=false; sb.append(quote(e.getKey())).append(":" ).append(valToJson(e.getValue())); }\n    sb.append("}"); return sb.toString();\n  }\n  static String quote(String s){ return "\\""+s.replace("\\\\","\\\\\\\\").replace("\\"","\\\\\\"")+"\\""; }\n  static String valToJson(Object v){ if (v==null) return "null"; if (v instanceof String) return quote((String)v); if (v instanceof Number || v instanceof Boolean) return String.valueOf(v); return quote(String.valueOf(v)); }\n  static List<Map<String,Object>> parseTests(String json){\n    List<Map<String,Object>> list = new ArrayList<>();\n    try{ String arr = json.trim(); if (!arr.startsWith("[")) return list; arr = arr.substring(1, arr.length()-1).trim(); if (arr.isEmpty()) return list; String[] parts = arr.split("\\\\},\\\\s*\\\\{"); for (int i=0;i<parts.length;i++){ String p = parts[i]; if (!p.startsWith("{")) p = "{"+p; if (!p.endsWith("}")) p = p+"}"; Map<String,Object> m = new LinkedHashMap<>(); m.put("raw", p); list.add(m);} }catch(Exception e){}\n    return list;\n  }\n}\n`;
}

function buildCpp(userCode: string, driver: string, tests: any[]) {
  const testStr = safeJSON(tests);
  const drv = (driver && driver.trim().length)
    ? driver
    : `// Provide either void runTests(const std::vector<nlohmann::json>& tests) or solve(...)
void runTests(const std::vector<std::string>& tests) {
  std::cout << "No driver provided; implement runTests or solve(...)" << std::endl;
}
`;
  return `#include <bits/stdc++.h>\nusing namespace std;\n${userCode}\n${drv}\nint main(){\n  string json = "${testStr.replace(/"/g, '\\"')}";\n  cout<<json<<endl;\n  return 0;\n}\n`;
}

function maybeInjectSkeleton(current: string, lang: string) {
  const trimmed = (current || '').trim();
  const looksEmpty = trimmed === '' || trimmed.startsWith('// Start coding');
  if (!looksEmpty) return current;
  switch ((lang || '').toLowerCase()) {
    case 'javascript':
      return `// Implement solve(...) and use tests to validate\nfunction solve() {\n  // TODO\n}\n`;
    case 'java':
      return `class Solution {\n  // TODO: implement methods\n}\n`;
    case 'cpp':
      return `#include <bits/stdc++.h>\nusing namespace std;\n// TODO: implement solution functions\n`;
    default:
      return current;
  }
}

function mergeTests(sampleText: string, privateText: string) {
  const s = (() => { try { return JSON.parse(sampleText || "[]"); } catch { return []; } })();
  const p = (() => { try { return JSON.parse(privateText || "[]"); } catch { return []; } })();
  return [...s, ...p];
}

export default function InterviewPage() {
  const { sessionId } = useParams() as { sessionId: string };
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start coding...\n");
  const [problemText, setProblemText] = useState("");
  const [privateTests, setPrivateTests] = useState("");
  const [sampleTests, setSampleTests] = useState("");
  const [driver, setDriver] = useState("");
  const [role, setRole] = useState<"interviewer" | "interviewee">("interviewee");
  const channelRef = useRef<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // camera and mic states
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const [showAuthModal, setShowAuthModal] = useState(false);
  
  useEffect(() => {
    (async () => {
      try {
        const [roleRes, stateRes] = await Promise.all([
          fetch(`/api/interview/role?sessionId=${sessionId}`),
          fetch(`/api/interview/state?sessionId=${sessionId}`),
        ]);
        if (roleRes.status === 401 || stateRes.status === 401) {
          setShowAuthModal(true);
          return;
        }

        const roleData = await roleRes.json();
        if (roleRes.ok && (roleData.role === "interviewer" || roleData.role === "interviewee"))
          setRole(roleData.role);
        const stateData = await stateRes.json();
        if (stateRes.ok && stateData) {
          if (typeof stateData.language === "string") setLanguage(stateData.language);
          if (typeof stateData.code === "string") setCode(stateData.code);
          if (typeof stateData.problemText === "string") setProblemText(stateData.problemText);
          if (typeof stateData.sampleTests === "string") setSampleTests(stateData.sampleTests);
          if (typeof stateData.driver === "string") setDriver(stateData.driver);
        }
      } catch {}
    })();

    if (!supabase) return;
    const channel = supabase.channel(`interview-${sessionId}`);
    channelRef.current = channel;

    channel.on("broadcast", { event: "state" }, (payload: any) => {
      const { language, code, problemText, sampleTests, driver } = payload?.payload || {};
      if (language) setLanguage(language);
      if (typeof code === "string") setCode(code);
      if (typeof problemText === "string") setProblemText(problemText);
      if (typeof sampleTests === "string") setSampleTests(sampleTests);
      if (typeof driver === "string") setDriver(driver);
    });

    channel.subscribe(async (status: any) => {
      if (status === "SUBSCRIBED") {
        // no-op
      }
    });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [sessionId]);

  const broadcast = (data: any) => {
    channelRef.current?.send({ type: "broadcast", event: "state", payload: data });
  };

  const saveTimeout = useRef<any>(null);
  const persist = (patch: any) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch("/api/interview/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, ...patch }),
        });
      } catch {}
    }, 400);
  };

  const [runOutput, setRunOutput] = useState<string>("");
  const [caseResults, setCaseResults] = useState<any[]>([]);
  
  const onRun = async () => {
    try {
      // Build a compile-only harness to quickly catch syntax issues (esp. Java/C++)
      const testsAll = mergeTests(sampleTests, privateTests);
      const harness = buildHarness(language, code, driver, testsAll);
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, source_code: harness, sessionId, problemId: "run" }),
      });
      const out = await res.json();
      const compileErr = out?.compile_output;
      const stderr = out?.stderr;
      if (compileErr || stderr) {
        setRunOutput(String(compileErr || stderr));
        return;
      }
      // If compiled & ran, show only sample results to interviewee, full results to interviewer
      const stdout = out?.stdout || "";
      if (!stdout) {
        setRunOutput("No output");
        setCaseResults([]);
        return;
      }
      // Expect JSON array of per-case results from harness
      try {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          setCaseResults(parsed);
          setRunOutput("");
        } else {
          setRunOutput(stdout);
          setCaseResults([]);
        }
      } catch {
        setRunOutput(stdout);
        setCaseResults([]);
      }
    } catch (e: any) {
      setRunOutput("Run error");
    }
  };

  const onSubmitFinal = async () => {
    setSubmitting(true);
    try {
      // Optionally persist latest code
      await fetch("/api/interview/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
      });
      // Submit to submissions API for tracking & limits
      const resultsStr = JSON.stringify(caseResults || []);
      const r = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, problemId: "custom", language, code, results: resultsStr }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error || "Submit failed");
      } else {
        alert("Submitted!");
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
      {/* Left column (40%) */}
      <div className="w-[40%] flex flex-col justify-between bg-gray-900 text-white p-4 space-y-4">
        {/* Video Feeds */}
        <div className="flex flex-col space-y-4 flex-1 overflow-y-auto">
          {/* Local Video */}
          <div className="w-full aspect-video bg-gray-700 rounded-xl flex items-center justify-center">
            <VideoCall room={`interview-${sessionId}`} role={role} />
          </div>

          {/* Remote Video (placeholder if needed) */}
          <div className="w-full aspect-video bg-gray-700 rounded-xl flex items-center justify-center">
            <p className="text-gray-300">Interviewer / Peer Video</p>
          </div>
        </div>

        {/* Camera + Mic Controls */}
        <div className="flex items-center justify-center space-x-4 mt-4">
          <Button
            variant="secondary"
            size="icon"
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700"
            onClick={() => setCameraOn(!cameraOn)}
          >
            {cameraOn ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5 text-red-500" />
            )}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700"
            onClick={() => setMicOn(!micOn)}
          >
            {micOn ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5 text-red-500" />
            )}
          </Button>
        </div>
      </div>

      {/* Right column (60%) */}
      <div className="w-[60%] p-4 overflow-y-auto relative">
        {showAuthModal && (
          <AuthModal onClose={() => setShowAuthModal(false)} />
        )}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={language}
              onChange={(e) => {
                const lang = e.target.value;
                setLanguage(lang);
                // If code looks like initial placeholder, set a starter skeleton
                setCode((prev) => maybeInjectSkeleton(prev, lang));
                broadcast({ language: lang });
                persist({ language: lang });
              }}
              className="border rounded px-2 py-1"
            >
              {allowedLangs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <button className="px-3 py-1 bg-black text-white rounded" onClick={onRun}>
              Run
            </button>

            {role === "interviewee" && (
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={onSubmitFinal}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            )}
          </div>

          <div className="border rounded overflow-hidden">
            <MonacoEditor
              height="65vh"
              defaultLanguage="javascript"
              language={language}
              value={code}
              onChange={(v: string | undefined) => {
                const nv = v || "";
                setCode(nv);
                broadcast({ code: nv });
                persist({ code: nv });
              }}
              options={{ minimap: { enabled: false } }}
            />
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Run Output</h3>
              {runOutput && (
                <pre className="bg-gray-50 border rounded p-2 max-h-48 overflow-auto text-sm whitespace-pre-wrap">{runOutput}</pre>
              )}
              {!runOutput && (
                <>
                  <RunSummary results={caseResults} sampleText={sampleTests} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {renderCaseCards(caseResults, role, sampleTests)}
                  </div>
                </>
              )}
            </div>
            {role === "interviewer" && (
              <div>
                <h2 className="font-semibold">Problem (paste area)</h2>
                <textarea
                  className="w-full h-56 border rounded p-2"
                  value={problemText}
                  onChange={(e) => {
                    setProblemText(e.target.value);
                    broadcast({ problemText: e.target.value });
                    persist({ problemText: e.target.value });
                  }}
                  placeholder="Paste problem description, constraints and examples here"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    className="px-3 py-1 bg-gray-200 rounded"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/tests/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ problemText, language }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          const tests = Array.isArray(data.tests) ? data.tests : [];
                          const extended = tests.slice(0, 20);
                          const pretty = JSON.stringify(extended, null, 2);
                          setPrivateTests(pretty);
                          if (typeof data.driver === 'string') {
                            setDriver(data.driver);
                            broadcast({ driver: data.driver });
                            persist({ driver: data.driver });
                          }
                        } else {
                          alert(data?.error || "Failed to generate tests");
                        }
                      } catch {
                        alert("Failed to generate tests");
                      }
                    }}
                  >
                    Get 20 edge test cases (Gemini)
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold">Sample Tests (visible to both)</h3>
              <textarea
                className="w-full h-36 border rounded p-2"
                value={sampleTests}
                onChange={(e) => {
                  setSampleTests(e.target.value);
                  broadcast({ sampleTests: e.target.value });
                  persist({ sampleTests: e.target.value });
                }}
                placeholder='Example: [{"input":..., "output":...}]'
              />
            </div>

            {role === "interviewer" && (
              <div>
                <h3 className="font-semibold">Private Tests (interviewer only)</h3>
                <textarea
                  className="w-full h-40 border rounded p-2"
                  value={privateTests}
                  onChange={(e) => setPrivateTests(e.target.value)}
                  placeholder='Example: [{"input":..., "output":...}]'
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="px-3 py-1 bg-gray-800 text-white rounded"
                onClick={async () => {
                  try {
                    const tests = (() => { try { return JSON.parse(sampleTests || "[]"); } catch { return []; } })();
                    const harness = buildHarness(language, code, driver, tests);
                    const res = await fetch("/api/execute", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ language, source_code: harness, sessionId, problemId: "sample" }),
                    });
                    const out = await res.json();
                    alert(res.ok ? prettyResult(out) : out.error || "Run failed");
                  } catch {
                    alert("Failed to run sample tests");
                  }
                }}
              >
                Run Sample Tests
              </button>

              {role === 'interviewer' && (
                <button
                  className="px-3 py-1 bg-purple-700 text-white rounded"
                  onClick={async () => {
                    try {
                      const tests = (() => { try { return JSON.parse(privateTests || "[]"); } catch { return []; } })();
                      const harness = buildHarness(language, code, driver, tests);
                      const res = await fetch("/api/execute", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ language, source_code: harness, sessionId, problemId: "private" }),
                      });
                      const out = await res.json();
                      alert(res.ok ? prettyResult(out) : out.error || "Run failed");
                    } catch {
                      alert("Failed to run private tests");
                    }
                  }}
                >
                  Run Private Tests
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}