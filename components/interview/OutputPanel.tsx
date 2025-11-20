import { Role, TestCaseResult } from "@/lib/types";
import { stringifyCompact } from "@/lib/interviewUtils";

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
        <div className={`rounded border p-2 text-sm ${allPass ? 'border-green-500 bg-green-50 text-green-800' : 'border-yellow-500 bg-yellow-50 text-yellow-800'}`}>
            {allPass ? 'All test cases passed' : 'Some test cases failed'}
            <span className="ml-2">({passed}/{total} passed)</span>
        </div>
    );
}

function CaseCard({ result, idx, isPrivate, role }: { result: TestCaseResult, idx: number, isPrivate: boolean, role: Role }) {
    const pass = !!result?.pass && !result?.error;
    const border = pass ? 'border-green-500' : 'border-red-500';
    const locked = isPrivate && role === 'interviewee';

    return (
        <div className={`border-2 rounded p-3 ${border}`}>
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
                    {result?.error ? (
                        <div className="text-red-600">{String(result.error)}</div>
                    ) : (
                        <>
                            {'got' in result && <div><span className="font-mono">got:</span> {stringifyCompact(result.got)}</div>}
                            {'exp' in result && <div><span className="font-mono">exp:</span> {stringifyCompact(result.exp)}</div>}
                            <div className={pass ? 'text-green-600' : 'text-red-600'}>{pass ? 'PASS' : 'FAIL'}</div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function OutputPanel({ runOutput, caseResults, sampleTests, role }: OutputPanelProps) {
    const sampleCount = (() => { try { return JSON.parse(sampleTests || '[]').length; } catch { return 0; } })();

    return (
        <div>
            <h3 className="font-semibold">Run Output</h3>
            {runOutput && (
                <pre className="bg-gray-50 border rounded p-2 max-h-48 overflow-auto text-sm whitespace-pre-wrap">{runOutput}</pre>
            )}
            {!runOutput && (
                <>
                    <RunSummary results={caseResults} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
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
                </>
            )}
        </div>
    );
}
