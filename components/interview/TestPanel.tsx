import { Role } from "@/lib/types";
import { buildHarness, prettyResult } from "@/lib/interviewUtils";

interface TestPanelProps {
    sampleTests: string;
    setSampleTests: (v: string) => void;
    privateTests: string;
    setPrivateTests: (v: string) => void;
    problemText: string;
    setProblemText: (v: string) => void;
    role: Role;
    language: string;
    code: string;
    driver: string;
    sessionId: string;
    setDriver: (v: string) => void;
}

export function TestPanel({
    sampleTests,
    setSampleTests,
    privateTests,
    setPrivateTests,
    problemText,
    setProblemText,
    role,
    language,
    code,
    driver,
    sessionId,
    setDriver
}: TestPanelProps) {

    const runTests = async (type: 'sample' | 'private') => {
        try {
            const testsText = type === 'sample' ? sampleTests : privateTests;
            const tests = (() => { try { return JSON.parse(testsText || "[]"); } catch { return []; } })();
            const harness = buildHarness(language, code, driver, tests);
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language, source_code: harness, sessionId, problemId: type }),
            });
            const out = await res.json();
            alert(res.ok ? prettyResult(out) : out.error || "Run failed");
        } catch {
            alert(`Failed to run ${type} tests`);
        }
    };

    const generateTests = async () => {
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
                }
            } else {
                alert(data?.error || "Failed to generate tests");
            }
        } catch {
            alert("Failed to generate tests");
        }
    };

    return (
        <div className="space-y-3">
            {role === "interviewer" ? (
                <div>
                    <h2 className="font-semibold">Problem (paste area)</h2>
                    <textarea
                        className="w-full h-56 border rounded p-2"
                        value={problemText}
                        onChange={(e) => setProblemText(e.target.value)}
                        placeholder="Paste problem description, constraints and examples here"
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            className="px-3 py-1 bg-gray-200 rounded"
                            onClick={generateTests}
                        >
                            Get 20 edge test cases (Gemini)
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <h2 className="font-semibold mb-2">Problem Description</h2>
                    <div className="w-full h-56 border rounded p-2 bg-gray-50 overflow-y-auto whitespace-pre-wrap text-sm">
                        {problemText || "Waiting for interviewer to paste problem..."}
                    </div>
                </div>
            )}

            <div>
                <h3 className="font-semibold mb-2">Sample Tests (visible to both)</h3>

                {/* Render parsed test cases as cards */}
                <div className="space-y-2 mb-3">
                    {(() => {
                        try {
                            const tests = JSON.parse(sampleTests || "[]");
                            if (!Array.isArray(tests) || tests.length === 0) return <p className="text-sm text-gray-500">No test cases added yet.</p>;
                            return tests.map((t: any, i: number) => (
                                <div key={i} className="border rounded p-2 bg-gray-50 text-sm">
                                    <div className="font-medium text-xs text-gray-500 mb-1">Case {i + 1}</div>
                                    <div className="grid grid-cols-1 gap-1">
                                        <div><span className="font-semibold">Input:</span> <code className="bg-gray-200 px-1 rounded">{JSON.stringify(t.input)}</code></div>
                                        <div><span className="font-semibold">Output:</span> <code className="bg-gray-200 px-1 rounded">{JSON.stringify(t.output)}</code></div>
                                    </div>
                                </div>
                            ));
                        } catch {
                            return <p className="text-sm text-red-500">Invalid JSON format</p>;
                        }
                    })()}
                </div>

                {/* Edit area (collapsible or always visible for interviewer) */}
                <details className="text-sm" open={role === 'interviewer'}>
                    <summary className="cursor-pointer text-gray-600 mb-1">Edit Raw JSON</summary>
                    <textarea
                        className="w-full h-36 border rounded p-2 font-mono text-xs"
                        value={sampleTests}
                        onChange={(e) => setSampleTests(e.target.value)}
                        placeholder='Example: [{"input":..., "output":...}]'
                    />
                </details>
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
                    onClick={() => runTests('sample')}
                >
                    Run Sample Tests
                </button>

                {role === 'interviewer' && (
                    <button
                        className="px-3 py-1 bg-purple-700 text-white rounded"
                        onClick={() => runTests('private')}
                    >
                        Run Private Tests
                    </button>
                )}
            </div>
        </div>
    );
}
