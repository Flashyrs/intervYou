import { Role } from "@/lib/types";
import { useState, useEffect } from "react";
import { Play, Send, Code2, ChevronDown } from "lucide-react";

interface ControlBarProps {
    language: string;
    setLanguage: (lang: string) => void;
    onRun: () => void;
    onSubmitFinal: () => void;
    submitting: boolean;
    role: Role;
    lastEditor?: { name: string, role: string, timestamp: number } | null;
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
}: ControlBarProps) {
    const [showEditorParams, setShowEditorParams] = useState(false);

    // Auto-hide last editor message after 2 seconds
    useEffect(() => {
        if (lastEditor) {
            setShowEditorParams(true);
            const t = setTimeout(() => setShowEditorParams(false), 2000);
            return () => clearTimeout(t);
        }
    }, [lastEditor]);

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
                <button
                    className="flex items-center gap-2 px-4 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition border border-gray-200"
                    onClick={onRun}
                >
                    <Play className="w-4 h-4 fill-current" />
                    Run Code
                </button>

                {role === "interviewee" && (
                    <button
                        className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={onSubmitFinal}
                        disabled={submitting}
                    >
                        <Send className="w-4 h-4" />
                        {submitting ? "Submitting..." : "Submit Solution"}
                    </button>
                )}
            </div>
        </div>
    );
}
