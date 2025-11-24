import { useState } from "react";
import { buildHarness, mergeTests } from "@/lib/interviewUtils";

interface UseCodeExecutionProps {
    sessionId: string;
    language: string;
    code: string;
    driver: string;
    sampleTests: string;
    privateTests: string;
}

export function useCodeExecution({
    sessionId,
    language,
    code,
    driver,
    sampleTests,
    privateTests,
}: UseCodeExecutionProps) {
    const [runOutput, setRunOutput] = useState<string>("");
    const [caseResults, setCaseResults] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

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
            const compileErr = out?.compile_output;
            const stderr = out?.stderr;
            if (compileErr || stderr) {
                setRunOutput(String(compileErr || stderr));
                return;
            }

            const stdout = out?.stdout || "";
            if (!stdout) {
                setRunOutput("No output");
                setCaseResults([]);
                return;
            }

            try {
                const parsed = JSON.parse(stdout);
                if (Array.isArray(parsed)) {
                    setCaseResults(parsed);
                    setRunOutput("");
                } else {
                    setRunOutput(stdout);
                    setCaseResults([]);
                }
            } catch {
                setRunOutput(stdout);
                setCaseResults([]);
            }
        } catch (e: any) {
            setRunOutput("Run error");
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
                body: JSON.stringify({ sessionId, problemId: "custom", language, code, results: resultsStr }),
            });
            const j = await r.json();
            if (!r.ok) {
                alert(j?.error || "Submit failed");
            } else {
                alert("Submitted!");
            }
        } catch { }
        setSubmitting(false);
    };

    return {
        runOutput,
        caseResults,
        submitting,
        onRun,
        onSubmitFinal,
        setRunOutput,
        setCaseResults
    };
}
