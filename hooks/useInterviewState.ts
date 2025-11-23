import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { maybeInjectSkeleton } from "@/lib/interviewUtils";

export type Role = "interviewer" | "interviewee";

export function useInterviewState(sessionId: string) {
    const { data: session } = useSession();
    const userId = (session?.user as any)?.id as string | undefined;

    const [language, setLanguage] = useState("javascript");
    const [codeMap, setCodeMap] = useState<Record<string, string>>({
        javascript: "// Start coding...\n",
        java: "// Start coding...\n",
        cpp: "// Start coding...\n"
    });
    const [driverMap, setDriverMap] = useState<Record<string, string>>({});

    const [problemText, setProblemText] = useState("");
    const [sampleTests, setSampleTests] = useState("");
    const [privateTests, setPrivateTests] = useState("");
    const [role, setRole] = useState<Role>("interviewee");
    const [showAuthModal, setShowAuthModal] = useState(false);

    const channelRef = useRef<any>(null);
    const saveTimeout = useRef<any>(null);
    const pendingBroadcastRef = useRef<any>({});
    const broadcastTimeout = useRef<any>(null);
    const lastUpdateRef = useRef<number>(0);

    // Helper to get current code/driver
    const code = codeMap[language] || "";
    const driver = driverMap[language] || "";

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
                    if (stateData.codeMap) setCodeMap(stateData.codeMap);
                    else if (typeof stateData.code === "string") {
                        // Migration from single code
                        setCodeMap(prev => ({ ...prev, [stateData.language || 'javascript']: stateData.code }));
                    }

                    if (stateData.driverMap) setDriverMap(stateData.driverMap);
                    else if (typeof stateData.driver === "string") {
                        setDriverMap(prev => ({ ...prev, [stateData.language || 'javascript']: stateData.driver }));
                    }

                    if (typeof stateData.problemText === "string") setProblemText(stateData.problemText);
                    if (typeof stateData.sampleTests === "string") setSampleTests(stateData.sampleTests);
                }
            } catch { }
        })();
    }, [sessionId]);

    const [executionResult, setExecutionResult] = useState<any>(null);

    // Realtime subscription
    useEffect(() => {
        if (!supabase) return;
        const channel = supabase.channel(`interview-${sessionId}`);
        channelRef.current = channel;

        channel.on("broadcast", { event: "state" }, (payload: any) => {
            const { userId: senderId, language, codeMap: newCodeMap, driverMap: newDriverMap, problemText, sampleTests, timestamp } = payload?.payload || {};

            // Ignore own broadcasts to prevent self-update loops
            if (senderId && userId && senderId === userId) {
                return;
            }

            // Still check timestamp but less aggressively
            if (timestamp && timestamp < lastUpdateRef.current) {
                return;
            }

            if (language) setLanguage(language);
            if (newCodeMap) setCodeMap(prev => ({ ...prev, ...newCodeMap }));
            if (newDriverMap) setDriverMap(prev => ({ ...prev, ...newDriverMap }));
            if (typeof problemText === "string") setProblemText(problemText);
            if (typeof sampleTests === "string") setSampleTests(sampleTests);
        });

        channel.on("broadcast", { event: "execution_result" }, (payload: any) => {
            setExecutionResult(payload.payload);
        });

        channel.subscribe((status) => {
            // Subscription callback ensures proper channel connection
        });

        return () => {
            supabase?.removeChannel(channel);
        };
    }, [sessionId]);

    const broadcast = (data: any) => {
        pendingBroadcastRef.current = { ...pendingBroadcastRef.current, ...data };

        if (broadcastTimeout.current) clearTimeout(broadcastTimeout.current);

        broadcastTimeout.current = setTimeout(() => {
            const timestamp = Date.now();
            lastUpdateRef.current = timestamp;

            const payload = { ...pendingBroadcastRef.current, userId, timestamp };
            pendingBroadcastRef.current = {};

            channelRef.current?.send({
                type: "broadcast",
                event: "state",
                payload
            });
        }, 100);
    };

    const broadcastExecutionResult = (result: any) => {
        channelRef.current?.send({
            type: "broadcast",
            event: "execution_result",
            payload: result
        });
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
        }, 1000);
    };

    const updateLanguage = (lang: string) => {
        setLanguage(lang);
        setCodeMap(prev => {
            const current = prev[lang] || "";
            const injected = maybeInjectSkeleton(current, lang);
            if (injected !== current) {
                const next = { ...prev, [lang]: injected };
                broadcast({ language: lang, codeMap: next });
                persist({ language: lang, codeMap: next });
                return next;
            }
            broadcast({ language: lang });
            persist({ language: lang });
            return prev;
        });
    };

    const updateCode = (newCode: string) => {
        setCodeMap(prev => {
            const next = { ...prev, [language]: newCode };
            broadcast({ codeMap: next });
            persist({ codeMap: next });
            return next;
        });
    };

    const setCodeMapFull = (map: Record<string, string>) => {
        setCodeMap(map);
        broadcast({ codeMap: map });
        persist({ codeMap: map });
    };

    const setDriverMapFull = (map: Record<string, string>) => {
        setDriverMap(map);
        broadcast({ driverMap: map });
        persist({ driverMap: map });
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
        setDriverMap(prev => {
            const next = { ...prev, [language]: text };
            broadcast({ driverMap: next });
            persist({ driverMap: next });
            return next;
        });
    };

    return {
        language,
        code,
        codeMap,
        problemText,
        sampleTests,
        privateTests,
        driver,
        driverMap,
        role,
        showAuthModal,
        setShowAuthModal,
        setPrivateTests,
        updateLanguage,
        updateCode,
        setCodeMapFull,
        setDriverMapFull,
        updateProblemText,
        updateSampleTests,
        updateDriver,
        broadcast,
        persist,
        executionResult,
        broadcastExecutionResult
    };
}
