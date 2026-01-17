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
    const [remoteCursors, setRemoteCursors] = useState<Record<string, any>>({});
    const [lastEditor, setLastEditor] = useState<{ name: string, role: string, timestamp: number } | null>(null);

    const channelRef = useRef<any>(null);
    const saveTimeout = useRef<any>(null);
    const pendingBroadcastRef = useRef<any>({});
    const broadcastTimeout = useRef<any>(null);
    const lastUpdateRef = useRef<number>(0);
    const lastLocalEditRef = useRef<number>(0);


    const code = codeMap[language] || "";
    const driver = driverMap[language] || "";


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


        if (userId) {
            fetch('/api/interview/presence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, action: 'join' }),
            }).catch(() => { });
        }


        return () => {
            if (userId) {
                fetch('/api/interview/presence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, action: 'leave' }),
                }).catch(() => { });
            }
        };
    }, [sessionId, userId]);

    const [executionResult, setExecutionResult] = useState<any>(null);


    const clientIdRef = useRef<string>(Math.random().toString(36).substring(7));

    useEffect(() => {
        if (!supabase) {
            // Fallback: Poll for state updates every 2 seconds if Supabase isn't configured
            console.warn("Supabase not configured, using polling fallback for sync");
            const pollInterval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/interview/state?sessionId=${sessionId}`);
                    if (res.ok) {
                        const stateData = await res.json();
                        if (stateData) {
                            // Only update if data is newer (basic check)
                            if (typeof stateData.language === "string" && stateData.language !== language) {
                                setLanguage(stateData.language);
                            }
                            if (stateData.codeMap) {
                                setCodeMap(prev => {
                                    const hasChanges = Object.keys(stateData.codeMap).some(
                                        key => stateData.codeMap[key] !== prev[key]
                                    );
                                    return hasChanges ? stateData.codeMap : prev;
                                });
                            }
                            if (stateData.driverMap) {
                                setDriverMap(prev => {
                                    const hasChanges = Object.keys(stateData.driverMap).some(
                                        key => stateData.driverMap[key] !== prev[key]
                                    );
                                    return hasChanges ? stateData.driverMap : prev;
                                });
                            }
                            if (typeof stateData.problemText === "string") {
                                setProblemText(prev => stateData.problemText !== prev ? stateData.problemText : prev);
                            }
                            if (typeof stateData.sampleTests === "string") {
                                setSampleTests(prev => stateData.sampleTests !== prev ? stateData.sampleTests : prev);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, 2000); // Poll every 2 seconds

            return () => clearInterval(pollInterval);
        }

        // Original Supabase real-time logic
        const channel = supabase.channel(`interview-${sessionId}`);
        channelRef.current = channel;

        channel.on("broadcast", { event: "state" }, (payload: any) => {
            const { clientId: senderClientId, language: newLang, codeMap: newCodeMap, driverMap: newDriverMap, problemText: newProb, sampleTests: newTests, cursor, timestamp } = payload?.payload || {};

            // Echo cancellation: only skip if it's from THIS exact client
            if (senderClientId && senderClientId === clientIdRef.current) {
                return;
            }

            // Simple timestamp check to avoid out-of-order updates
            // (Optional: strict timestamp checking might reject valid concurrent edits in LWW, 
            // but we keep it for basic ordering)
            if (timestamp && timestamp < lastUpdateRef.current) {
                return;
            }

            // Update state from broadcast

            // 1. Language Update
            if (newLang) {
                setLanguage(newLang);
            }

            // 2. Code Update (Patch) - WITH DEBOUNCE
            if (newCodeMap) {
                const timeSinceLastEdit = Date.now() - lastLocalEditRef.current;
                // If user typed recently (<300ms), IGNORE remote code updates to prevent jitter/overwrite
                if (timeSinceLastEdit > 300) {
                    setCodeMap(prev => ({ ...prev, ...newCodeMap }));

                    // Update Last Editor Indicator
                    if (payload?.payload?.role) {
                        setLastEditor({
                            name: payload.payload.userId || "Peer",
                            role: payload.payload.role,
                            timestamp: Date.now()
                        });
                    }
                }
            }

            // 3. Driver Update
            if (newDriverMap) {
                setDriverMap(prev => ({ ...prev, ...newDriverMap }));
            }

            if (typeof newProb === "string") {
                setProblemText(newProb);
            }
            if (typeof newTests === "string") {
                setSampleTests(newTests);
            }

            // 4. Cursor Update
            if (cursor && senderClientId) {
                setRemoteCursors(prev => ({ ...prev, [senderClientId]: cursor }));
            }
        });

        channel.on("broadcast", { event: "execution_result" }, (payload: any) => {
            console.log("📨 Received execution result broadcast");
            setExecutionResult(payload.payload);
        });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("✅ Supabase channel subscribed");
            } else if (status === 'CHANNEL_ERROR') {
                console.error("❌ Supabase channel error");
            }
        });

        return () => {
            supabase?.removeChannel(channel);
        };
    }, [sessionId]);

    const broadcastCursor = (position: { lineNumber: number, column: number }) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "state",
                payload: {
                    clientId: clientIdRef.current,
                    cursor: { ...position, userId, timestamp: Date.now() }
                }
            }).catch(() => { });
        }
    };

    const broadcast = (data: any) => {
        pendingBroadcastRef.current = { ...pendingBroadcastRef.current, ...data };

        if (broadcastTimeout.current) clearTimeout(broadcastTimeout.current);

        broadcastTimeout.current = setTimeout(() => {
            const timestamp = Date.now();
            lastUpdateRef.current = timestamp;

            const payload = {
                ...pendingBroadcastRef.current,
                userId,
                role, // Broadcast role for "Last edited by..."
                clientId: clientIdRef.current,
                timestamp
            };
            pendingBroadcastRef.current = {};

            // Try Supabase broadcast
            if (channelRef.current) {
                channelRef.current.send({
                    type: "broadcast",
                    event: "state",
                    payload
                }).catch((e: any) => {
                    console.warn("⚠️ Broadcast failed (Supabase):", e.message);
                });
            } else {
                console.warn("⚠️ No Supabase channel, relying on polling fallback");
            }

            // Always persist to database as backup
            persist(payload);
        }, 100);
    };

    const broadcastExecutionResult = (result: any) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "execution_result",
                payload: result
            }).catch((e: any) => {
                console.error("❌ Execution result broadcast failed:", e);
            });
        } else {
            console.warn("⚠️ No channel for execution broadcast");
        }
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
            // Skeleton injection ONLY for interviewee
            let nextCode = current;
            if (role === 'interviewee') {
                nextCode = maybeInjectSkeleton(current, lang);
            }

            if (nextCode !== current) {
                const next = { ...prev, [lang]: nextCode };
                const patch = { language: lang, codeMap: { [lang]: nextCode } };
                broadcast(patch);
                persist(patch);
                return next;
            }

            broadcast({ language: lang });
            persist({ language: lang });
            return prev;
        });
    };

    const updateCode = (newCode: string) => {
        lastLocalEditRef.current = Date.now(); // Mark local edit time
        setCodeMap(prev => {
            const next = { ...prev, [language]: newCode };
            // Broadcast PATCH only
            const patch = { codeMap: { [language]: newCode } };
            broadcast(patch);
            persist(patch);
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
        broadcastExecutionResult,
        remoteCursors,
        broadcastCursor,
        lastEditor
    };
}
