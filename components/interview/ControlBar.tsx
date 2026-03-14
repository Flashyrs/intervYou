import { Role } from "@/lib/types";
import { useState, useEffect } from "react";
import { Play, Send, Code2, ChevronDown, RotateCcw, CheckCircle2, Square, LogOut, Clock, Pause, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface ControlBarProps {
    language: string;
    setLanguage: (lang: string) => void;
    onRun: () => void;
    onSubmitFinal: () => void;
    submitting: boolean;
    role: Role;
    lastEditor?: { name: string, role: string, timestamp: number } | null;
    isFrozen?: boolean;
    onToggleFreeze?: () => void;
    timerState?: { active: boolean, startTimestamp: number | null, accumulated: number };
    updateTimerState?: (newState: { active: boolean, startTimestamp: number | null, accumulated: number }) => void;
    sessionId: string;
    endSession?: () => Promise<void>;
    onNextQuestion?: () => void;
}

const allowedLangs = [
    { id: "javascript", name: "JavaScript" },
    { id: "java", name: "Java" },
    { id: "cpp", name: "C++" },
];

export function ControlBar({
    language,
    setLanguage,
    onRun,
    onSubmitFinal,
    submitting,
    role,
    lastEditor,
    isFrozen,
    onToggleFreeze,
    timerState,
    updateTimerState,
    sessionId,
    endSession,
    onNextQuestion
}: ControlBarProps) {
    const [showEditorParams, setShowEditorParams] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const router = useRouter();
    const { push } = useToast();

    // Synced Timer logic
    useEffect(() => {
        let interval: any;
        
        const updateElapsed = () => {
            if (!timerState) return;
            if (timerState.active && timerState.startTimestamp) {
                const now = Date.now();
                const diff = Math.floor((now - timerState.startTimestamp) / 1000);
                setElapsed(timerState.accumulated + diff);
            } else {
                setElapsed(timerState.accumulated || 0);
            }
        };

        // Initial update
        updateElapsed();

        if (timerState?.active) {
            interval = setInterval(updateElapsed, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timerState]);

    const handleTimerToggle = () => {
        if (!timerState || !updateTimerState) return;
        
        if (timerState.active) {
            // Pause: Add the currently ticking elapsed seconds to the accumulated total
            const diff = timerState.startTimestamp ? Math.floor((Date.now() - timerState.startTimestamp) / 1000) : 0;
            updateTimerState({
                active: false,
                startTimestamp: null,
                accumulated: timerState.accumulated + diff
            });
        } else {
            // Start: Initialize startTimestamp to exactly Date.now()
            updateTimerState({
                active: true,
                startTimestamp: Date.now(),
                accumulated: timerState.accumulated
            });
        }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        if (h === '00') return `${m}:${s}`;
        return `${h}:${m}:${s}`;
    };

    // Auto-hide last editor message after 2 seconds
    useEffect(() => {
        if (lastEditor) {
            setShowEditorParams(true);
            const t = setTimeout(() => setShowEditorParams(false), 2000);
            return () => clearTimeout(t);
        }
    }, [lastEditor]);

    // Heartbeat check
    useEffect(() => {
        if (!sessionId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/session/${sessionId}/heartbeat`, { method: "POST" });
                if (res.status === 410) {
                    // Session ended
                    push({ message: "This session has ended.", type: "error" });
                    router.push("/dashboard");
                }
            } catch (e) {
                console.error("Heartbeat failed", e);
            }
        }, 60000); // Every 1 minute

        // Initial call
        fetch(`/api/session/${sessionId}/heartbeat`, { method: "POST" }).catch(() => { });

        return () => clearInterval(interval);
    }, [sessionId, router, push]);

    const endInterview = async () => {
        if (!confirm("Are you sure you want to end this interview? This cannot be undone.")) return;

        try {
            if (endSession) {
                await endSession();
            } else {
                // Fallback (shouldn't happen with new logic)
                const res = await fetch(`/api/session/${sessionId}/end`, { method: "POST" });
                if (res.ok) {
                    router.push("/dashboard");
                }
            }
        } catch (e) {
            push({ message: "Failed to end interview", type: "error" });
        }
    };

    const handleNextQuestion = () => {
        if (!confirm("Are you sure you want to move to the next question? This will clear the current code and problem statement for everyone.")) return;
        if (onNextQuestion) onNextQuestion();
    };

    return (
        <div className="flex items-center justify-between h-12 px-2">
            <div className="flex items-center gap-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Code2 className="h-4 w-4 text-gray-500" />
                    </div>
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="pl-9 pr-8 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none cursor-pointer hover:bg-gray-100 transition min-w-[140px]"
                    >
                        {allowedLangs.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.name}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                </div>

                {/* Last Editor Indicator */}
                <div className={`text-xs text-gray-500 transition-opacity duration-300 ${showEditorParams ? 'opacity-100' : 'opacity-0'}`}>
                    {lastEditor && (
                        <span>Last edited by <span className="font-semibold capitalize">{lastEditor.role}</span></span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Freeze Toggle (Interviewer Only) */}
                {role === "interviewer" && onToggleFreeze && (
                    <button
                        onClick={onToggleFreeze}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition border whitespace-nowrap shrink-0 ${isFrozen
                            ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            }`}
                        title="Pause session for explanation"
                    >
                        {isFrozen ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isFrozen ? "Resume Session" : "Pause Session"}
                    </button>
                )}

                {role === "interviewer" && onNextQuestion && (
                    <button
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-md text-sm font-medium hover:bg-indigo-50 transition"
                        title="Clear session variables for a new problem"
                    >
                        <RotateCcw className="w-4 h-4 fill-current" />
                        Next Question
                    </button>
                )}

                {role === "interviewer" && (
                    <button
                        onClick={endInterview}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-md text-sm font-medium hover:bg-red-50 transition"
                        title="End interview for everyone"
                    >
                        <Square className="w-4 h-4 fill-current" />
                        End
                    </button>
                )}

                <button
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition border border-gray-200 whitespace-nowrap shrink-0"
                    onClick={onRun}
                >
                    <Play className="w-4 h-4 fill-current" />
                    Run Code
                </button>

                {role === "interviewee" && (
                    <button
                        className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                        onClick={onSubmitFinal}
                        disabled={submitting}
                    >
                        <Send className="w-4 h-4" />
                        {submitting ? "Submitting..." : "Submit Solution"}
                    </button>
                )}

                <button
                    onClick={() => router.push('/dashboard')}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                    title="Leave Room"
                >
                    <LogOut className="w-4 h-4" />
                </button>
                
                {/* Synced Timer Display */}
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md shadow-sm ml-2 overflow-hidden h-8">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 text-sm font-medium min-w-[70px] justify-center">
                        <Clock className={`w-3.5 h-3.5 ${timerState?.active ? 'text-indigo-500 animate-pulse' : 'text-gray-400'}`} />
                        <span className="tabular-nums tracking-tight">{formatTime(elapsed)}</span>
                    </div>
                    {role === 'interviewer' && (
                        <button
                            onClick={handleTimerToggle}
                            className={`flex items-center justify-center px-2.5 h-full border-l border-gray-200 transition ${
                                timerState?.active 
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                            title={timerState?.active ? "Pause Timer" : "Start Timer"}
                        >
                            {timerState?.active ? <Pause className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
