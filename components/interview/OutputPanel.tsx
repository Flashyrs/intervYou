import { useState, useEffect } from "react";
import { Role, TestCaseResult, ExecutionMetrics } from "@/lib/types";
import { stringifyCompact } from "@/lib/interviewUtils";
import { CheckCircle2, XCircle, Lock, AlertCircle, Terminal, ChevronUp, ChevronDown, Clock, HardDrive } from "lucide-react";

interface OutputPanelProps {
    runOutput: string;
    caseResults: TestCaseResult[];
    sampleTests: string;
    privateTests: string;
    role: Role;
    metrics?: ExecutionMetrics;
}


function RunSummary({ results, metrics }: { results: TestCaseResult[], metrics?: ExecutionMetrics }) {
    const total = results?.length || 0;
    const passed = (results || []).filter((r) => r && r.pass && !r.error).length;
    if (total === 0) return null;
    const allPass = passed === total;

    return (
        <div className={`rounded-lg border mb-4 ${allPass
            ? 'bg-green-50/50 border-green-200'
            : 'bg-red-50/50 border-red-200'
            }`}>
            {/* Status & Test Count */}
            <div className="flex items-center gap-2 p-3">
                <div className={`flex items-center gap-2 ${allPass ? 'text-green-700' : 'text-red-700'}`}>
                    {allPass ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <div className="font-medium">
                        {allPass ? 'Accepted' : 'Wrong Answer'}
                    </div>
                </div>
                <div className={`text-sm opacity-80 ml-auto ${allPass ? 'text-green-700' : 'text-red-700'}`}>
                    {passed}/{total} test cases passed
                </div>
            </div>

            {/* Metrics */}
            {(metrics?.time !== undefined || metrics?.memory !== undefined) && (
                <div className="px-3 pb-3 flex gap-4">
                    {metrics.time !== undefined && (
                        <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1.5 rounded border border-gray-200">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium text-gray-700">{metrics.time.toFixed(2)} ms</span>
                        </div>
                    )}
                    {metrics.memory !== undefined && (
                        <div className="flex items-center gap-1.5 text-xs bg-white px-2.5 py-1.5 rounded border border-gray-200">
                            <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium text-gray-700">{(metrics.memory / 1024).toFixed(2)} MB</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CaseCard({ result, idx, isPrivate, role, input, testType, forceExpanded }: { result: TestCaseResult, idx: number, isPrivate: boolean, role: Role, input?: any, testType: 'sample' | 'edge' | 'hidden', forceExpanded?: boolean }) {
    const pass = !!result?.pass && !result?.error;
    const isError = !!result?.error;
    const locked = isPrivate && role === 'interviewee';
    // Auto-expand first failure or if forced
    const [expanded, setExpanded] = useState(forceExpanded || false);

    useEffect(() => {
        if (forceExpanded !== undefined) setExpanded(forceExpanded);
    }, [forceExpanded]);

    // Get readable label and color for test type
    const getTypeInfo = () => {
        if (testType === 'sample') return { label: 'Sample', color: 'bg-blue-100 text-blue-700' };
        if (testType === 'edge') return { label: 'Edge', color: 'bg-orange-100 text-orange-700' };
        return { label: 'Hidden', color: 'bg-gray-100 text-gray-700' };
    };

    const typeInfo = getTypeInfo();

    // Truncate long inputs for preview
    const getInputPreview = () => {
        if (!input) return null;
        const str = stringifyCompact(input);
        return str.length > 30 ? str.substring(0, 30) + '...' : str;
    };

    return (
        <div className={`group border rounded-lg overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${pass ? 'border-gray-200 hover:border-green-300' : 'border-red-300 bg-red-50/20'
            }`}>
            <button
                onClick={() => !locked && setExpanded(!expanded)}
                className={`w-full p-3 text-left ${locked ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'} transition-colors`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 ${pass
                            ? 'bg-green-100 text-green-700'
                            : isError ? 'bg-red-100 text-red-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {pass ? '✓' : '✕'}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-800">Case {idx + 1}</span>
                                {isPrivate && (
                                    <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${typeInfo.color}`}>
                                        <Lock className="w-2.5 h-2.5" /> {typeInfo.label}
                                    </span>
                                )}
                            </div>
                            {/* Show input preview when collapsed */}
                            {!expanded && !locked && input && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                                    {getInputPreview()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {!locked && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${pass ? 'bg-green-50 text-green-700' : isError ? 'bg-red-50 text-red-700' : 'bg-red-50 text-red-700'}`}>
                                {pass ? 'Passed' : isError ? 'Error' : 'Failed'}
                            </span>
                        )}
                        {!locked && (
                            <div className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        )}
                    </div>
                </div>
            </button>

            {!locked && expanded && (
                <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gradient-to-b from-gray-50/50 to-transparent text-sm space-y-2.5">
                    {result?.error ? (
                        <div className="flex gap-2 text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="font-mono text-xs whitespace-pre-wrap break-words">{String(result.error)}</div>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {/* Input */}
                            {input !== undefined && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Input</div>
                                    <div className="font-mono bg-white p-2.5 rounded-lg border text-gray-800 text-xs break-all">
                                        {stringifyCompact(input)}
                                    </div>
                                </div>
                            )}
                            {/* Expected Output */}
                            {'exp' in result && (
                                <div className="space-y-1">
                                    <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Expected</div>
                                    <div className="font-mono bg-green-50 p-2.5 rounded-lg border border-green-200 text-green-900 text-xs break-all">
                                        {stringifyCompact(result.exp)}
                                    </div>
                                </div>
                            )}
                            {/* Actual Output */}
                            {'got' in result && (
                                <div className="space-y-1">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${pass ? 'text-green-600' : 'text-red-600'}`}>Your Output</div>
                                    <div className={`font-mono p-2.5 rounded-lg border text-xs break-all ${pass ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                                        {stringifyCompact(result.got)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {locked && (
                <div className="px-3 pb-3 pt-0 text-xs text-gray-400 italic flex items-center gap-1.5 pl-12">
                    <Lock className="w-3 h-3" />
                    Hidden from interviewee
                </div>
            )}
        </div>
    );
}

export function OutputPanel({ runOutput, caseResults, sampleTests, privateTests, role, metrics }: OutputPanelProps) {
    const [minimized, setMinimized] = useState(false); // Start expanded
    const [expandAll, setExpandAll] = useState(false);

    // Parse sample and private tests to get all inputs
    const sampleTestsArray = (() => {
        try {
            return JSON.parse(sampleTests || '[]');
        } catch {
            return [];
        }
    })();
    const privateTestsArray = (() => {
        try {
            return JSON.parse(privateTests || '[]');
        } catch {
            return [];
        }
    })();

    // Merge all tests to get complete input list
    const allTests = [...sampleTestsArray, ...privateTestsArray];
    const sampleCount = sampleTestsArray.length;

    // Auto-expand when results come in
    useEffect(() => {
        if (runOutput || (caseResults && caseResults.length > 0)) {
            setMinimized(false);
        }
    }, [runOutput, caseResults]);

    if (minimized) {
        return (
            <div className="bg-white border-t shadow-lg">
                <button
                    onClick={() => setMinimized(false)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition"
                >
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600 uppercase tracking-wider">
                        <Terminal className="w-4 h-4" />
                        Output / Console
                    </div>
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        );
    }

    // Find first failed test index
    const firstFailureIdx = caseResults.findIndex(r => !r?.pass || r?.error);

    return (
        <div className="flex flex-col bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] h-[50vh] transition-all duration-300">
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border-b shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                        <Terminal className="w-4 h-4" />
                        Output / Console
                    </div>
                    {caseResults.length > 0 && (
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setExpandAll(true)}
                                className="text-[10px] px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded font-medium transition-colors"
                            >
                                Expand All
                            </button>
                            <button
                                onClick={() => setExpandAll(false)}
                                className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors"
                            >
                                Collapse All
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setMinimized(true)}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                    title="Minimize output panel"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {runOutput && (
                    <div className="mb-4 pb-4 border-b border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Debug Output</div>
                        <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded">{runOutput}</pre>
                    </div>
                )}

                {(!caseResults || caseResults.length === 0) ? (
                    !runOutput && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm py-8">
                            <Terminal className="w-8 h-8 mb-2 opacity-20" />
                            <p>Run code to see results</p>
                        </div>
                    )
                ) : (
                    <div className="space-y-4">
                        <RunSummary results={caseResults} metrics={metrics} />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                            {caseResults.map((r, idx) => {
                                // Get input for this test case from merged test array
                                const testInput = allTests[idx]?.input;

                                // Determine test type based on index
                                let testType: 'sample' | 'edge' | 'hidden';
                                if (idx < 4) {
                                    testType = 'sample';
                                } else if (idx < 9) {
                                    testType = 'edge';
                                } else {
                                    testType = 'hidden';
                                }

                                // Auto-expand first failure or use expandAll state
                                const shouldExpand = expandAll || (idx === firstFailureIdx && idx !== -1);

                                return (
                                    <CaseCard
                                        key={idx}
                                        result={r}
                                        idx={idx}
                                        isPrivate={idx >= sampleCount}
                                        role={role}
                                        input={testInput}
                                        testType={testType}
                                        forceExpanded={shouldExpand}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
