import { Role } from "@/lib/types";

interface ControlBarProps {
    language: string;
    setLanguage: (lang: string) => void;
    onRun: () => void;
    onSubmitFinal: () => void;
    submitting: boolean;
    role: Role;
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
}: ControlBarProps) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border rounded px-2 py-1"
            >
                {allowedLangs.map((l) => (
                    <option key={l.id} value={l.id}>
                        {l.name}
                    </option>
                ))}
            </select>

            <button className="px-3 py-1 bg-black text-white rounded" onClick={onRun}>
                Run
            </button>

            {role === "interviewee" && (
                <button
                    className="px-3 py-1 bg-green-600 text-white rounded"
                    onClick={onSubmitFinal}
                    disabled={submitting}
                >
                    {submitting ? "Submitting..." : "Submit"}
                </button>
            )}
        </div>
    );
}
