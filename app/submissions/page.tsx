"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, HardDrive, Code2, Calendar, CheckCircle, XCircle, Eye, ArrowLeft } from "lucide-react";

interface Submission {
    id: string;
    sessionId: string;
    problemText: string | null;
    language: string;
    code: string;
    passed: boolean;
    time: number | null;
    memory: number | null;
    createdAt: string;
    results: any;
}

export default function SubmissionsPage() {
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        try {
            const res = await fetch("/api/submissions");
            if (res.ok) {
                const data = await res.json();
                setSubmissions(data);
            }
        } catch (error) {
            console.error("Failed to fetch submissions:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-600">Loading your interview history...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Submissions</h1>
                        <p className="text-gray-600 mt-1">View your coding interview submissions and performance</p>
                    </div>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                </div>

                {/* Stats Summary */}
                {submissions.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="text-sm text-gray-600 mb-1">Total Submissions</div>
                            <div className="text-3xl font-bold text-gray-900">{submissions.length}</div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="text-sm text-gray-600 mb-1">Passed</div>
                            <div className="text-3xl font-bold text-green-600">
                                {submissions.filter(s => s.passed).length}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="text-sm text-gray-600 mb-1">Failed</div>
                            <div className="text-3xl font-bold text-red-600">
                                {submissions.filter(s => !s.passed).length}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="text-sm text-gray-600 mb-1">Success Rate</div>
                            <div className="text-3xl font-bold text-indigo-600">
                                {Math.round((submissions.filter(s => s.passed).length / submissions.length) * 100)}%
                            </div>
                        </div>
                    </div>
                )}

                {/* Submissions List */}
                {submissions.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Code2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No submissions yet</h3>
                        <p className="text-gray-600">Start your first interview to see your submissions here</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {submissions.map((submission) => {
                            const results = Array.isArray(submission.results) ? submission.results : JSON.parse(submission.results || "[]");
                            const totalTests = results.length;
                            const passedTests = results.filter((r: any) => r.pass).length;

                            return (
                                <div
                                    key={submission.id}
                                    className={`bg-white rounded-lg shadow hover:shadow-md transition border-l-4 ${submission.passed ? 'border-green-500' : 'border-red-500'
                                        }`}
                                >
                                    <div className="p-6">
                                        {/* Header Row */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {submission.passed ? (
                                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                                    ) : (
                                                        <XCircle className="w-6 h-6 text-red-600" />
                                                    )}
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {submission.problemText?.split('\n')[0] || 'Coding Problem'}
                                                    </h3>
                                                </div>

                                                {/* Metadata */}
                                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-4 h-4" />
                                                        {new Date(submission.createdAt).toLocaleDateString()} {new Date(submission.createdAt).toLocaleTimeString()}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Code2 className="w-4 h-4" />
                                                        {submission.language.toUpperCase()}
                                                    </div>
                                                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${submission.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>
                                                        {passedTests}/{totalTests} tests passed
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setSelectedCode(selectedCode === submission.id ? null : submission.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium transition"
                                            >
                                                <Eye className="w-4 h-4" />
                                                {selectedCode === submission.id ? 'Hide Code' : 'View Code'}
                                            </button>
                                        </div>

                                        {/* Metrics */}
                                        {(submission.time !== null || submission.memory !== null) && (
                                            <div className="flex gap-3 mb-4">
                                                {submission.time !== null && (
                                                    <div className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded border">
                                                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                                                        <span className="font-medium text-gray-700">{submission.time.toFixed(2)} ms</span>
                                                    </div>
                                                )}
                                                {submission.memory !== null && (
                                                    <div className="flex items-center gap-1.5 text-xs bg-gray-50 px-3 py-1.5 rounded border">
                                                        <HardDrive className="w-3.5 h-3.5 text-gray-500" />
                                                        <span className="font-medium text-gray-700">{(submission.memory / 1024).toFixed(2)} MB</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Code Viewer */}
                                        {selectedCode === submission.id && (
                                            <div className="mt-4 border-t pt-4">
                                                <div className="text-sm font-medium text-gray-700 mb-2">Submitted Code:</div>
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                                                    <code>{submission.code}</code>
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
