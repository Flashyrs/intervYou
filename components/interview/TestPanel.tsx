import { useState, useEffect } from "react";
import { Role } from "@/lib/types";
import { buildHarness, prettyResult } from "@/lib/interviewUtils";
import { Sparkles, Play, Lock, FileText, Code2, Layers, AlertCircle, Plus, Trash2 } from "lucide-react";

interface TestPanelProps {
    sampleTests: string;
    setSampleTests: (v: string) => void;
    privateTests: string;
    setPrivateTests: (v: string) => void;
    problemText: string;
    setProblemText: (v: string) => void;
    problemTitle?: string;
    setProblemTitle?: (v: string) => void;
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
    problemTitle,
    setProblemTitle,
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
    const [activeTab, setActiveTab] = useState<'problem' | 'tests'>('problem');

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
                if (data.enhancedTitle && setProblemTitle) setProblemTitle(data.enhancedTitle);

                // Unified test parsing
                let all: any[] = [];
                if (data.allTestCases && Array.isArray(data.allTestCases)) {
                    all = data.allTestCases;
                } else if (data.testCases && Array.isArray(data.testCases)) {
                    // Backwards compat: manually tag
                    all = [
                        ...data.testCases.slice(0, 4).map((t: any) => ({ ...t, category: 'sample' })),
                        ...data.testCases.slice(4).map((t: any) => ({ ...t, category: 'hidden' }))
                    ];
                }

                // Split
                const sample = all.filter((t: any) => t.category === "sample");
                const privateT = all.filter((t: any) => t.category === "edge" || t.category === "hidden");

                setSampleTests(JSON.stringify(sample, null, 2));
                setPrivateTests(JSON.stringify(privateT, null, 2));

                if (data.skeletons) setCodeMapFull(data.skeletons);
                if (data.drivers) setDriverMapFull(data.drivers);
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
        <div className="flex flex-col h-full bg-white select-none">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('problem')}
                        className={`text-sm font-medium transition-colors ${activeTab === 'problem' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Problem
                    </button>
                    <button
                        onClick={() => setActiveTab('tests')}
                        className={`text-sm font-medium transition-colors ${activeTab === 'tests' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Test Cases
                    </button>
                </div>

                {role === "interviewer" && activeTab === 'problem' && (
                    <button
                        onClick={enhanceWithAI}
                        disabled={enhancing || !problemText}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium hover:bg-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Sparkles className="w-3 h-3" />
                        {enhancing ? "Enhancing..." : "Auto-Enhance"}
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'problem' ? (
                    <div className="h-full overflow-y-auto p-6 scrollbar-thin">
                        {role === "interviewer" ? (
                            <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-300">
                                <input
                                    className="w-full text-2xl font-bold placeholder-gray-300 border-none focus:ring-0 p-0 text-gray-900 bg-transparent"
                                    placeholder="Problem Title"
                                    value={problemTitle || ""}
                                    onChange={(e) => setProblemTitle?.(e.target.value)}
                                />
                                <div className="relative group flex-1 min-h-0 flex flex-col">
                                    <textarea
                                        className="w-full flex-1 resize-none border-none focus:ring-0 p-0 text-gray-600 text-base leading-relaxed bg-transparent placeholder-gray-300"
                                        placeholder="Paste the problem description here..."
                                        value={problemText}
                                        onChange={(e) => setProblemText(e.target.value)}
                                    />
                                    {!problemText && (
                                        <div className="absolute top-0 left-0 pointer-events-none text-gray-300">
                                            <p>Example:</p>
                                            <p className="mt-2">Given an array of integers...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-sm max-w-none">
                                <h1 className="text-xl font-bold text-gray-900 mb-4">{problemTitle || "Problem"}</h1>
                                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans">
                                    {problemText || "Waiting for problem description..."}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto p-4 space-y-6 scrollbar-thin animate-in fade-in duration-300">
                        {/* Sample Tests Section */}
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <Code2 className="w-3 h-3" />
                                    Sample Tests (Visible)
                                </h3>
                            </div>
                            <div className="space-y-3">
                                <TestsRenderer
                                    json={sampleTests}
                                    editable={role === 'interviewer'}
                                    onChange={setSampleTests}
                                />
                            </div>
                        </section>

                        {/* Private Tests Section (Interviewer Only) */}
                        {role === "interviewer" && (
                            <section className="pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                                        <Lock className="w-3 h-3" />
                                        Private Tests (Hidden)
                                    </h3>
                                </div>
                                <div className="bg-indigo-50/50 rounded-lg p-1">
                                    <TestCaseEditor
                                        json={privateTests}
                                        onChange={setPrivateTests}
                                    />
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function TestsRenderer({ json, editable, onChange }: { json: string, editable: boolean, onChange: (v: string) => void }) {
    try {
        const tests = JSON.parse(json || "[]");
        if (!Array.isArray(tests) || tests.length === 0) {
            return <div className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">No test cases defined</div>;
        }

        return (
            <div className="space-y-3">
                {tests.map((t: any, i: number) => (
                    <div key={i} className="group relative bg-gray-50 rounded-md p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono">
                            <span className="text-gray-400 text-xs uppercase tracking-wide py-0.5">Input</span>
                            <div className="text-gray-800 break-all">{JSON.stringify(t.input)}</div>

                            <span className="text-gray-400 text-xs uppercase tracking-wide py-0.5">Expect</span>
                            <div className="text-gray-800 break-all">{JSON.stringify(t.output)}</div>
                        </div>
                    </div>
                ))}
                {editable && (
                    <details className="mt-2">
                        <summary className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer list-none flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> Edit Raw JSON
                        </summary>
                        <textarea
                            className="w-full mt-2 h-32 font-mono text-xs border rounded-md p-2 bg-gray-900 text-gray-100"
                            value={json}
                            onChange={e => onChange(e.target.value)}
                        />
                    </details>
                )}
            </div>
        );
    } catch {
        return <div className="text-red-500 text-sm bg-red-50 p-2 rounded">Invalid JSON Format</div>;
    }
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
            // Try to parse input if it looks like JSON/Array/Object, otherwise keep string
            let parsedVal = value;
            try { parsedVal = JSON.parse(value); } catch { }

            newCases[index] = { ...newCases[index], [field]: parsedVal };
            onChange(JSON.stringify(newCases, null, 2));
        } catch (e) { }
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
        <div className="space-y-3">
            {cases.map((c, i) => (
                <div key={i} className="bg-white rounded border border-indigo-100 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Test Case {i + 1}</span>
                        <button onClick={() => removeCase(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        <div>
                            <input
                                className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 rounded px-2 py-1 text-xs font-mono transition-all"
                                placeholder="Input (JSON)"
                                value={typeof c.input === 'string' ? c.input : JSON.stringify(c.input)}
                                onChange={(e) => updateCase(i, 'input', e.target.value)}
                            />
                        </div>
                        <div>
                            <input
                                className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-200 rounded px-2 py-1 text-xs font-mono transition-all"
                                placeholder="Expected Output (JSON)"
                                value={typeof c.output === 'string' ? c.output : JSON.stringify(c.output)}
                                onChange={(e) => updateCase(i, 'output', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={addCase}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-indigo-600 border border-dashed border-indigo-200 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-all"
            >
                <Plus className="w-3 h-3" />
                Add Hidden Case
            </button>
        </div>
    );
}
