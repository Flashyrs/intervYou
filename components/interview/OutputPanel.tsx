import { useState } from "react";
import { Role, TestCaseResult } from "@/lib/types";
import { stringifyCompact } from "@/lib/interviewUtils";
import { CheckCircle2, XCircle, Lock, AlertCircle, Terminal } from "lucide-react";

interface OutputPanelProps {
    runOutput: string;
    caseResults: TestCaseResult[];
    sampleTests: string;
    role: Role;
}

function RunSummary({ results }: { results: TestCaseResult[] }) {
    const total = results?.length || 0;
    const passed = (results || []).filter((r) => r && r.pass && !r.error).length;
    if (total === 0) return null;
    const allPass = passed === total;

    return (
        <div className={`flex items-center gap-2 p-3 rounded-lg border mb-4 ${allPass
                ? 'bg-green-50/50 border-green-200 text-green-700'
                : 'bg-red-50/50 border-red-200 text-red-700'
            }`}>
            {allPass ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <div className="font-medium">
                {allPass ? 'Accepted' : 'Wrong Answer'}
            </div>
            <div className="text-sm opacity-80 ml-auto">
                {passed}/{total} test cases passed
            </div>
        </div>
    );
}

function CaseCard({ result, idx, isPrivate, role }: { result: TestCaseResult, idx: number, isPrivate: boolean, role: Role }) {
    const pass = !!result?.pass && !result?.error;
    const isError = !!result?.error;
    const locked = isPrivate && role === 'interviewee';
    const [expanded, setExpanded] = useState(!pass); 

    return (
        <div className={`group border rounded-lg overflow-hidden transition-all duration-200 ${pass ? 'border-gray-200 hover:border-green-300' : 'border-red-200 bg-red-50/10'
            }`}>
            <button
                onClick={() => !locked && setExpanded(!expanded)}
                className={`w-full flex items-center justify-between p-3 text-left ${locked ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${pass
                            ? 'bg-green-100 text-green-700'
                            : isError ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {pass ? '✓' : '✕'}
                    </div>
                    <span className="font-medium text-sm text-gray-700">Case {idx + 1}</span>
                    {isPrivate && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            <Lock className="w-3 h-3" /> Private
                        </span>
                    )}
                </div>

                {!locked && (
                    <div className={`text-xs font-medium ${pass ? 'text-green-600' : 'text-red-600'}`}>
                        {pass ? 'Passed' : isError ? 'Error' : 'Failed'}
                    </div>
                )}
            </button>

            {!locked && expanded && (
                <div className="p-3 pt-0 border-t border-gray-100 bg-gray-50/50 text-sm space-y-2">
                    {result?.error ? (
                        <div className="flex gap-2 text-red-600 bg-red-50 p-2 rounded border border-red-100">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="font-mono text-xs whitespace-pre-wrap">{String(result.error)}</div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {'got' in result && (
                                <div className="space-y-1">
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Output</div>
                                    <div className="font-mono bg-white p-2 rounded border text-gray-800 text-xs">
                                        {stringifyCompact(result.got)}
                                    </div>
                                </div>
                            )}
                            {'exp' in result && (
                                <div className="space-y-1">
                                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Expected</div>
                                    <div className="font-mono bg-white p-2 rounded border text-gray-800 text-xs">
                                        {stringifyCompact(result.exp)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {locked && (
                <div className="px-3 pb-3 pt-0 text-xs text-gray-400 italic pl-12">
                    Hidden test case
                </div>
            )}
        </div>
    );
}

export function OutputPanel({ runOutput, caseResults, sampleTests, role }: OutputPanelProps) {
    const sampleCount = (() => { try { return JSON.parse(sampleTests || '[]').length; } catch { return 0; } })();

    if (runOutput) {
        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Terminal className="w-4 h-4" />
                    Console Output
                </div>
                <div className="flex-1 p-4 overflow-auto bg-white">
                    <pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap">{runOutput}</pre>
                </div>
            </div>
        );
    }

    if (!caseResults || caseResults.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                <Terminal className="w-8 h-8 mb-2 opacity-20" />
                <p>Run code to see results</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 pb-0">
                <h3 className="font-semibold text-gray-900 mb-4">Test Results</h3>
                <RunSummary results={caseResults} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-3">
                {caseResults.map((r, idx) => (
                    <CaseCard
                        key={idx}
                        result={r}
                        idx={idx}
                        isPrivate={idx >= sampleCount}
                        role={role}
                    />
                ))}
            </div>
        </div>
    );
}
