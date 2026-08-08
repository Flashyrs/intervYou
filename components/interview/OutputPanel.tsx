import { useState, useEffect } from "react";
import { Role, TestCaseResult, ExecutionMetrics } from "@/lib/types";
import { stringifyCompact } from "@/lib/interviewUtils";
import { CheckCircle2, XCircle, Lock, AlertCircle, Terminal, ChevronUp, ChevronDown, Clock, HardDrive } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface OutputPanelProps {
    runOutput: string;
    caseResults: TestCaseResult[];
    sampleTests: string;
    privateTests: string;
    role: Role;
    metrics?: ExecutionMetrics;
}


function RunSummary({ results, metrics }: { results: TestCaseResult[], metrics?: ExecutionMetrics }) {
    const { isDarkMode } = useTheme();
    const total = results?.length || 0;
    const passed = (results || []).filter((r) => r && r.pass && !r.error).length;
    if (total === 0) return null;
    const allPass = passed === total;

    return (
        <div className={`rounded-lg border mb-4 ${allPass
            ? isDarkMode ? 'bg-green-950/10 border-green-900/30' : 'bg-green-50/50 border-green-200'
            : isDarkMode ? 'bg-red-950/10 border-red-900/30' : 'bg-red-50/50 border-red-200'
            }`}>
            {/* Status & Test Count */}
            <div className="flex items-center gap-2 p-3">
                <div className={`flex items-center gap-2 ${allPass ? (isDarkMode ? 'text-green-400' : 'text-green-700') : (isDarkMode ? 'text-red-400' : 'text-red-700')}`}>
                    {allPass ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    <div className="font-medium">
                        {allPass ? 'Accepted' : 'Wrong Answer'}
                    </div>
                </div>
                <div className={`text-sm opacity-80 ml-auto ${allPass ? (isDarkMode ? 'text-green-400' : 'text-green-700') : (isDarkMode ? 'text-red-400' : 'text-red-700')}`}>
                    {passed}/{total} test cases passed
                </div>
            </div>

            {/* Metrics */}
            {(metrics?.time !== undefined || metrics?.memory !== undefined) && (
                <div className="px-3 pb-3 flex gap-4">
                    {metrics.time !== undefined && (
                        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium">{metrics.time.toFixed(2)} ms</span>
                        </div>
                    )}
                    {metrics.memory !== undefined && (
                        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border ${isDarkMode ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-medium">{(metrics.memory / 1024).toFixed(2)} MB</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CaseCard({ result, idx, isPrivate, role, input, testType, forceExpanded }: { result: TestCaseResult, idx: number, isPrivate: boolean, role: Role, input?: any, testType: 'sample' | 'edge' | 'hidden', forceExpanded?: boolean }) {
    const { isDarkMode } = useTheme();
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
        if (testType === 'sample') return { label: 'Sample', color: isDarkMode ? 'bg-blue-950/50 text-blue-400' : 'bg-blue-100 text-blue-700' };
        if (testType === 'edge') return { label: 'Edge', color: isDarkMode ? 'bg-orange-950/50 text-orange-400' : 'bg-orange-100 text-orange-700' };
        return { label: 'Test Case', color: isDarkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-700' };
    };

    const typeInfo = getTypeInfo();

    // Truncate long inputs for preview
    const getInputPreview = () => {
        if (!input) return null;
        const str = stringifyCompact(input);
        return str.length > 30 ? str.substring(0, 30) + '...' : str;
    };

    return (
        <div className={`group border rounded-sm overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${
            pass 
                ? isDarkMode ? 'border-zinc-805 hover:border-green-800 bg-zinc-900/30' : 'border-gray-200 hover:border-green-300' 
                : isDarkMode ? 'border-red-900/50 bg-red-950/10' : 'border-red-300 bg-red-50/20'
            }`}>
            <button
                onClick={() => !locked && setExpanded(!expanded)}
                className={`w-full p-3 text-left ${locked ? 'cursor-default' : `cursor-pointer ${isDarkMode ? 'hover:bg-zinc-800/40' : 'hover:bg-gray-50'}`} transition-colors`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold shrink-0 ${pass
                            ? isDarkMode ? 'bg-green-950/50 text-green-400' : 'bg-green-100 text-green-700'
                            : isDarkMode ? 'bg-red-950/50 text-red-400' : 'bg-red-100 text-red-700'
                            }`}>
                            {pass ? '✓' : '✕'}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`font-semibold text-sm ${isDarkMode ? 'text-zinc-200' : 'text-gray-800'}`}>Case {idx + 1}</span>
                                {isPrivate && (
                                    <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${typeInfo.color}`}>
                                        <Lock className="w-2.5 h-2.5" /> {typeInfo.label}
                                    </span>
                                )}
                            </div>
                            {/* Show input preview when collapsed */}
                            {!expanded && !locked && input && (
                                <div className={`text-[10px] font-mono mt-0.5 truncate ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                                    {getInputPreview()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            pass 
                                ? isDarkMode ? 'bg-green-950/30 text-green-400' : 'bg-green-50 text-green-700' 
                                : isDarkMode ? 'bg-red-950/30 text-red-400' : 'bg-red-50 text-red-700'
                        }`}>
                            {pass ? 'Passed' : isError ? 'Error' : 'Failed'}
                        </span>
                        {!locked && (
                            <div className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        )}
                    </div>
                </div>
            </button>

            {!locked && expanded && (
                <div className={`px-3 pb-3 pt-2 border-t text-sm space-y-2.5 ${isDarkMode ? 'border-zinc-800 bg-zinc-900/20' : 'border-gray-100 bg-gradient-to-b from-gray-50/50 to-transparent'}`}>
                    {result?.error ? (
                        <div className={`flex gap-2 p-3 rounded-lg border ${isDarkMode ? 'text-red-400 bg-red-950/20 border-red-900/30' : 'text-red-700 bg-red-50 border-red-200'}`}>
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="font-mono text-xs whitespace-pre-wrap break-words">{String(result.error)}</div>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {/* Input */}
                            {input !== undefined && (
                                <div className="space-y-1">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Input</div>
                                    <div className={`font-mono p-2.5 rounded-sm border text-xs break-all ${isDarkMode ? 'bg-zinc-950 border-zinc-805 text-zinc-300' : 'bg-white text-gray-800'}`}>
                                        {stringifyCompact(input)}
                                    </div>
                                </div>
                            )}
                            {/* Expected Output */}
                            {'exp' in result && (
                                <div className="space-y-1">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-green-500' : 'text-green-600'}`}>Expected</div>
                                    <div className={`font-mono p-2.5 rounded-sm border text-xs break-all ${isDarkMode ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-green-50 border-green-200 text-green-900'}`}>
                                        {stringifyCompact(result.exp)}
                                    </div>
                                </div>
                            )}
                            {/* Actual Output */}
                            {'got' in result && (
                                <div className="space-y-1">
                                    <div className={`text-[10px] font-bold uppercase tracking-wider ${pass ? (isDarkMode ? 'text-green-500' : 'text-green-600') : (isDarkMode ? 'text-red-500' : 'text-red-650')}`}>Your Output</div>
                                    <div className={`font-mono p-2.5 rounded-sm border text-xs break-all ${
                                        pass 
                                            ? isDarkMode ? 'bg-green-950/20 border-green-900/30 text-green-400' : 'bg-green-50 border-green-200 text-green-900'
                                            : isDarkMode ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-red-50 border-red-200 text-red-900'
                                    }`}>
                                        {stringifyCompact(result.got)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {locked && (
                <div className={`px-3 pb-3 pt-0 text-xs italic flex items-center gap-1.5 pl-12 ${isDarkMode ? 'text-zinc-550' : 'text-gray-400'}`}>
                    <Lock className="w-3 h-3" />
                    Hidden
                </div>
            )}
        </div>
    );
}

export function OutputPanel({ runOutput, caseResults, sampleTests, privateTests, role, metrics }: OutputPanelProps) {
    const [minimized, setMinimized] = useState(false); // Start expanded
    const [expandAll, setExpandAll] = useState(false);

    const { isDarkMode } = useTheme();

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
            <div className={`border-t shadow-lg ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white'}`}>
                <button
                    onClick={() => setMinimized(false)}
                    className={`w-full flex items-center justify-between px-4 py-2 transition ${isDarkMode ? 'bg-zinc-900/80 hover:bg-zinc-800' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                    <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
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
        <div className={`flex flex-col border-t h-full transition-all duration-300 ${isDarkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-150 shadow-none' : 'bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]'}`}>
            <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0 ${isDarkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gradient-to-r from-gray-50 to-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-zinc-350' : 'text-gray-700'}`}>
                        <Terminal className="w-4 h-4" />
                        Output / Console
                    </div>
                    {caseResults.length > 0 && (
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setExpandAll(true)}
                                className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                                    isDarkMode 
                                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-250' 
                                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                }`}
                            >
                                Expand All
                            </button>
                            <button
                                onClick={() => setExpandAll(false)}
                                className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                                    isDarkMode 
                                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-350' 
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Collapse All
                            </button>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setMinimized(true)}
                    className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-gray-250 text-gray-600'}`}
                    title="Minimize output panel"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {runOutput && (
                    <div className={`mb-4 pb-4 border-b ${isDarkMode ? 'border-zinc-800' : 'border-gray-100'}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-zinc-500' : 'text-gray-400'}`}>Debug Output</div>
                        <pre className={`font-mono text-xs whitespace-pre-wrap p-2 rounded border ${isDarkMode ? 'bg-zinc-950 text-zinc-300 border-zinc-800/80' : 'bg-gray-50 text-gray-600 border-transparent'}`}>{runOutput}</pre>
                    </div>
                )}

                {(!caseResults || caseResults.length === 0) ? (
                    !runOutput && (
                        <div className={`h-full flex flex-col items-center justify-center text-sm py-8 ${isDarkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
                            <Terminal className="w-8 h-8 mb-2 opacity-20" />
                            <p>Run code to see results</p>
                        </div>
                    )
                ) : (
                    <div className="space-y-4">
                        <RunSummary results={caseResults} metrics={metrics} />
                        <div className="flex flex-col gap-3">
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
