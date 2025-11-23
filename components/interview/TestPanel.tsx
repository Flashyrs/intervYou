import { useState, useEffect } from "react";
import { Role } from "@/lib/types";
import { buildHarness, prettyResult } from "@/lib/interviewUtils";
import { Sparkles, Play, Lock, FileText, Code2 } from "lucide-react";

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
    setCodeMapFull: (map: Record<string, string>) => void;
    setDriverMapFull: (map: Record<string, string>) => void;
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
    setDriver,
    setCodeMapFull,
    setDriverMapFull
}: TestPanelProps) {
    const [enhancing, setEnhancing] = useState(false);

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

    const enhanceWithAI = async () => {
        if (!problemText.trim()) {
            alert("Please paste a problem description first.");
            return;
        }
        setEnhancing(true);
        try {
            const res = await fetch("/api/ai/enhance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ problemText }),
            });
            const data = await res.json();
            if (res.ok) {
                if (data.enhancedProblem) setProblemText(data.enhancedProblem);
                if (data.testCases) {
                    const tests = Array.isArray(data.testCases) ? data.testCases : [];
                    // Split into sample (first 2) and private (rest)
                    const sample = tests.slice(0, 2);
                    const privateT = tests.slice(2);
                    setSampleTests(JSON.stringify(sample, null, 2));
                    setPrivateTests(JSON.stringify(privateT, null, 2));
                }
                if (data.skeletons) {
                    setCodeMapFull(data.skeletons);
                }
                if (data.drivers) {
                    setDriverMapFull(data.drivers);
                }
            } else {
                alert(data?.error || "Failed to enhance problem");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to call AI service");
        } finally {
            setEnhancing(false);
        }
    };

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Problem Section */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h2 className="font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Problem Description
                    </h2>
                    {role === "interviewer" && (
                        <button
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                            onClick={enhanceWithAI}
                            disabled={enhancing}
                        >
                            <Sparkles className="w-3 h-3" />
                            {enhancing ? "Enhancing..." : "Enhance with AI"}
                        </button>
                    )}
                </div>

                {role === "interviewer" ? (
                    <textarea
                        className="flex-1 w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        value={problemText}
                        onChange={(e) => setProblemText(e.target.value)}
                        placeholder="Paste raw problem description here..."
                    />
                ) : (
                    <div className="flex-1 w-full border rounded-lg p-4 bg-gray-50 overflow-y-auto prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap font-sans text-gray-800">
                            {problemText || "Waiting for interviewer to provide problem..."}
                        </div>
                    </div>
                )}
            </div>

            {/* Tests Section */}
            <div className="shrink-0 border-t pt-4 space-y-4">
                <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                        <Code2 className="w-4 h-4" />
                        Sample Tests
                    </h3>

                    <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                        {(() => {
                            try {
                                const tests = JSON.parse(sampleTests || "[]");
                                if (!Array.isArray(tests) || tests.length === 0) {
                                    return <p className="text-xs text-gray-400 italic p-2 border rounded border-dashed text-center">No sample tests</p>;
                                }
                                return tests.map((t: any, i: number) => (
                                    <div key={i} className="border rounded p-2 bg-gray-50 text-xs font-mono">
                                        <div className="flex gap-2">
                                            <span className="text-gray-500 select-none">In:</span>
                                            <span className="text-gray-800">{JSON.stringify(t.input)}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-gray-500 select-none">Out:</span>
                                            <span className="text-gray-800">{JSON.stringify(t.output)}</span>
                                        </div>
                                    </div>
                                ));
                            } catch {
                                return <p className="text-xs text-red-500">Invalid JSON</p>;
                            }
                        })()}
                    </div>

                    {role === 'interviewer' && (
                        <details className="text-xs">
                            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mb-1">Edit JSON</summary>
                            <textarea
                                className="w-full h-24 border rounded p-2 font-mono text-xs"
                                value={sampleTests}
                                onChange={(e) => setSampleTests(e.target.value)}
                                placeholder='[{"input":..., "output":...}]'
                            />
                        </details>
                    )}
                </div>

                {role === "interviewer" && (
                    <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                            <Lock className="w-4 h-4" />
                            Private Tests
                        </h3>
                        <TestCaseEditor
                            json={privateTests}
                            onChange={setPrivateTests}
                        />
                    </div>
                )}

                <div className="flex gap-2 pt-2">
                    <button
                        className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-md text-sm font-medium hover:bg-gray-900 transition flex items-center justify-center gap-2"
                        onClick={() => runTests('sample')}
                    >
                        <Play className="w-3 h-3" /> Run Sample
                    </button>

                    {role === 'interviewer' && (
                        <button
                            className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition flex items-center justify-center gap-2"
                            onClick={() => runTests('private')}
                        >
                            <Lock className="w-3 h-3" /> Run Private
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function TestCaseEditor({ json, onChange }: { json: string; onChange: (v: string) => void }) {
    const [cases, setCases] = useState<any[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        try {
            const parsed = JSON.parse(json || "[]");
            if (Array.isArray(parsed)) {
                setCases(parsed);
                setError("");
            }
        } catch {
            setError("Invalid JSON");
        }
    }, [json]);

    const updateCase = (index: number, field: 'input' | 'output', value: string) => {
        const newCases = [...cases];
        try {
            // Try to parse as JSON if possible, otherwise string
            // Actually, for input it MUST be an array of args.
            // For output it can be anything.
            // To keep it simple, we let user type JSON string and we try to parse it.
            let parsedVal = value;
            try {
                parsedVal = JSON.parse(value);
            } catch { }

            newCases[index] = { ...newCases[index], [field]: parsedVal };
            onChange(JSON.stringify(newCases, null, 2));
        } catch (e) {
            // If we can't stringify, ignore
        }
    };

    const addCase = () => {
        const newCases = [...cases, { input: [], output: null }];
        onChange(JSON.stringify(newCases, null, 2));
    };

    const removeCase = (index: number) => {
        const newCases = cases.filter((_, i) => i !== index);
        onChange(JSON.stringify(newCases, null, 2));
    };

    if (error) return <div className="text-red-500 text-xs">{error}</div>;

    return (
        <div className="space-y-2 border rounded p-2 bg-gray-50 max-h-48 overflow-y-auto">
            {cases.map((c, i) => (
                <div key={i} className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Case {i + 1}</span>
                        <button onClick={() => removeCase(i)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-gray-400 uppercase">Input (Args Array)</label>
                            <input
                                className="w-full border rounded px-2 py-1 text-xs font-mono"
                                value={JSON.stringify(c.input)}
                                onChange={(e) => updateCase(i, 'input', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 uppercase">Output</label>
                            <input
                                className="w-full border rounded px-2 py-1 text-xs font-mono"
                                value={JSON.stringify(c.output)}
                                onChange={(e) => updateCase(i, 'output', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={addCase}
                className="w-full py-1 text-xs text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50"
            >
                + Add Test Case
            </button>
        </div>
    );
}
