import { useState } from "react";
import { buildHarness, mergeTests } from "@/lib/interviewUtils";
import { ExecutionMetrics } from "@/lib/types";
import { useToast } from "@/components/Toast";

interface UseCodeExecutionProps {
    sessionId: string;
    language: string;
    code: string;
    driver: string;
    sampleTests: string;
    privateTests: string;
    problemText?: string;
}

export function useCodeExecution({
    sessionId,
    language,
    code,
    driver,
    sampleTests,
    privateTests,
    problemText,
}: UseCodeExecutionProps) {
    const [runOutput, setRunOutput] = useState<string>("");
    const [caseResults, setCaseResults] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [metrics, setMetrics] = useState<{ time?: number; memory?: number }>({});
    const { push } = useToast();

    const onRun = async () => {
        try {
            const testsAll = mergeTests(sampleTests, privateTests);

            const harness = buildHarness(language, code, driver, testsAll);

            const res = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ language, source_code: harness, sessionId, problemId: "run" }),
            });
            const out = await res.json();



            const executionTime = out?.time ? parseFloat(out.time) * 1000 : undefined;
            const memoryUsed = out?.memory ? parseInt(out.memory) : undefined;
            setMetrics({ time: executionTime, memory: memoryUsed });

            const compileErr = out?.compile_output;
            const stderr = out?.stderr;
            const stdout = out?.stdout || "";
            const delimiter = "___JSON_RESULT___";


            if (stdout.includes(delimiter)) {
                let jsonStr = stdout;
                let debugOutput = "";

                const parts = stdout.split(delimiter);
                debugOutput = parts[0].trim();
                jsonStr = parts[1].trim();

                if (compileErr || stderr) {
                    debugOutput = (debugOutput ? debugOutput + "\n\n" : "") + "--- Stderr/Warnings ---\n" + (compileErr || "") + (stderr || "");
                }

                try {
                    const parsed = JSON.parse(jsonStr);
                    if (Array.isArray(parsed)) {
                        setCaseResults(parsed);
                        setRunOutput(debugOutput);
                        return { caseResults: parsed, runOutput: debugOutput, metrics: { time: executionTime, memory: memoryUsed } };
                    }
                } catch (e) {
                    console.error("❌ JSON parse failed:", e);
                }
            }

            if (compileErr || stderr) {
                const rawErr = (compileErr || "") + "\n" + (stderr || "");
                console.warn("⚠️ Compilation/runtime error:", rawErr);
                setRunOutput(rawErr.trim());
                return { caseResults: [], runOutput: rawErr.trim(), metrics: { time: executionTime, memory: memoryUsed } };
            }

            if (!stdout) {
                console.warn("⚠️ No output from execution");
                setRunOutput("No output");
                setCaseResults([]);
                return { caseResults: [], runOutput: "No output", metrics: { time: executionTime, memory: memoryUsed } };
            }


            console.warn("⚠️ Stdout without delimiter:", stdout);
            setRunOutput(stdout);
            setCaseResults([]);
            return { caseResults: [], runOutput: stdout, metrics: { time: executionTime, memory: memoryUsed } };
        } catch (e: any) {
            console.error("❌ Run error:", e);
            setRunOutput("Run error: " + e.message);
            return { caseResults: [], runOutput: "Run error: " + e.message, metrics: {} };
        }
    };

    const onSubmitFinal = async () => {
        setSubmitting(true);
        try {

            await fetch("/api/interview/state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, code }),
            });

            const resultsStr = JSON.stringify(caseResults || []);
            const r = await fetch("/api/submissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    problemId: "custom",
                    language,
                    code,
                    results: resultsStr,
                    time: metrics.time,
                    memory: metrics.memory,
                    problemText: problemText || ""
                }),
            });
            const j = await r.json();
            if (!r.ok) {
                push({ message: j?.error || "Submit failed", type: "error" });
            } else {
                push({ message: "Solution submitted successfully!", type: "success" });
            }
        } catch {
            push({ message: "Network error during submission", type: "error" });
        }
        setSubmitting(false);
    };

    return {
        runOutput,
        caseResults,
        submitting,
        metrics,
        onRun,
        onSubmitFinal,
        setRunOutput,
        setCaseResults,
        setMetrics
    };
}
