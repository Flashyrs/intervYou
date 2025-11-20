import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { maybeInjectSkeleton } from "@/lib/interviewUtils";

export type Role = "interviewer" | "interviewee";

export function useInterviewState(sessionId: string) {
    const [language, setLanguage] = useState("javascript");
    const [code, setCode] = useState("// Start coding...\n");
    const [problemText, setProblemText] = useState("");
    const [sampleTests, setSampleTests] = useState("");
    const [privateTests, setPrivateTests] = useState("");
    const [driver, setDriver] = useState("");
    const [role, setRole] = useState<Role>("interviewee");
    const [showAuthModal, setShowAuthModal] = useState(false);

    const channelRef = useRef<any>(null);
    const saveTimeout = useRef<any>(null);

    // Initial fetch
    useEffect(() => {
        (async () => {
            try {
                const [roleRes, stateRes] = await Promise.all([
                    fetch(`/api/interview/role?sessionId=${sessionId}`),
                    fetch(`/api/interview/state?sessionId=${sessionId}`),
                ]);
                if (roleRes.status === 401 || stateRes.status === 401) {
                    setShowAuthModal(true);
                    return;
                }

                const roleData = await roleRes.json();
                if (roleRes.ok && (roleData.role === "interviewer" || roleData.role === "interviewee"))
                    setRole(roleData.role);
                const stateData = await stateRes.json();
                if (stateRes.ok && stateData) {
                    if (typeof stateData.language === "string") setLanguage(stateData.language);
                    if (typeof stateData.code === "string") setCode(stateData.code);
                    if (typeof stateData.problemText === "string") setProblemText(stateData.problemText);
                    if (typeof stateData.sampleTests === "string") setSampleTests(stateData.sampleTests);
                    if (typeof stateData.driver === "string") setDriver(stateData.driver);
                }
            } catch { }
        })();
    }, [sessionId]);

    // Realtime subscription
    useEffect(() => {
        if (!supabase) return;
        const channel = supabase.channel(`interview-${sessionId}`);
        channelRef.current = channel;

        channel.on("broadcast", { event: "state" }, (payload: any) => {
            console.log("Received state update:", payload); // DEBUG
            const { language, code, problemText, sampleTests, driver } = payload?.payload || {};

            if (language) setLanguage(language);
            if (typeof code === "string") setCode(code);
            if (typeof problemText === "string") setProblemText(problemText);
            if (typeof sampleTests === "string") setSampleTests(sampleTests);
            if (typeof driver === "string") setDriver(driver);
        });

        channel.subscribe((status) => {
            console.log("Supabase channel status:", status); // DEBUG
        });

        return () => {
            supabase?.removeChannel(channel);
        };
    }, [sessionId]);

    const broadcast = (data: any) => {
        console.log("Broadcasting update:", data); // DEBUG
        channelRef.current?.send({ type: "broadcast", event: "state", payload: data });
    };

    const persist = (patch: any) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
            try {
                await fetch("/api/interview/state", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, ...patch }),
                });
            } catch { }
        }, 400);
    };

    const updateLanguage = (lang: string) => {
        setLanguage(lang);
        setCode((prev) => maybeInjectSkeleton(prev, lang));
        broadcast({ language: lang });
        persist({ language: lang });
    };

    const updateCode = (newCode: string) => {
        setCode(newCode);
        broadcast({ code: newCode });
        persist({ code: newCode });
    };

    const updateProblemText = (text: string) => {
        setProblemText(text);
        broadcast({ problemText: text });
        persist({ problemText: text });
    };

    const updateSampleTests = (text: string) => {
        setSampleTests(text);
        broadcast({ sampleTests: text });
        persist({ sampleTests: text });
    };

    const updateDriver = (text: string) => {
        setDriver(text);
        broadcast({ driver: text });
        persist({ driver: text });
    };

    return {
        language,
        code,
        problemText,
        sampleTests,
        privateTests,
        driver,
        role,
        showAuthModal,
        setShowAuthModal,
        setPrivateTests,
        setDriver, // Exposed for direct setting if needed (e.g. from AI gen)
        updateLanguage,
        updateCode,
        updateProblemText,
        updateSampleTests,
        updateDriver,
        broadcast,
        persist
    };
}
