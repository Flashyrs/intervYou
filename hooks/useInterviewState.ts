import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { maybeInjectSkeleton } from "@/lib/interviewUtils";
import { getInterviewStateChannel } from "@/lib/sessionChannels";

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

    const [problemId, setProblemId] = useState<string>(() => Math.random().toString(36).substring(2, 15));
    const [problemText, setProblemText] = useState("");
    const [problemTitle, setProblemTitle] = useState("Problem 1"); // Default title
    const [sampleTests, setSampleTests] = useState("");
    const [privateTests, setPrivateTests] = useState("");
    const [role, setRole] = useState<Role>("interviewee");
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [remoteCursors, setRemoteCursors] = useState<Record<string, any>>({});
    const [lastEditor, setLastEditor] = useState<{ name: string, role: string, timestamp: number } | null>(null);
    const [isFrozen, setIsFrozen] = useState(false);
    const [timerState, setTimerState] = useState<{ active: boolean, startTimestamp: number | null, accumulated: number }>({ active: false, startTimestamp: null, accumulated: 0 });
    const [stateVersion, setStateVersion] = useState(0);
    const [interviewerNotes, setInterviewerNotes] = useState("");

    const channelRef = useRef<any>(null);
    const saveTimeout = useRef<any>(null);
    const notesSaveTimeout = useRef<any>(null);
    const pendingBroadcastRef = useRef<any>({});
    const broadcastTimeout = useRef<any>(null);
    const cursorBroadcastTimeout = useRef<any>(null);
    const pendingCursorRef = useRef<any>(null);
    const pendingPersistRef = useRef<any>({});
    const lastUpdateRef = useRef<number>(0);
    const lastLocalEditRef = useRef<number>(0);
    const stateVersionRef = useRef<number>(0);


    const code = codeMap[language] || "";
    const driver = driverMap[language] || "";

    const applyServerState = (stateData: any) => {
        if (!stateData) return;

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
        if (typeof stateData.problemTitle === "string") setProblemTitle(stateData.problemTitle);
        if (typeof stateData.problemId === "string") setProblemId(stateData.problemId);
        if (typeof stateData.sampleTests === "string") setSampleTests(stateData.sampleTests);
        if (typeof stateData.privateTests === "string") setPrivateTests(stateData.privateTests);
        if (typeof stateData.interviewerNotes === "string") setInterviewerNotes(stateData.interviewerNotes);
        if (typeof stateData.version === "number") {
            setStateVersion(stateData.version);
            stateVersionRef.current = stateData.version;
        }
        if (stateData.timerState) setTimerState(stateData.timerState);
        if (stateData.lastOutput !== undefined) setExecutionResult(stateData.lastOutput);
        if (stateData.isFrozen !== undefined) setIsFrozen(stateData.isFrozen);
    };

    const reloadAuthoritativeState = async () => {
        try {
            const res = await fetch(`/api/interview/state?sessionId=${sessionId}`, { cache: "no-store" });
            if (!res.ok) return;
            const stateData = await res.json();
            applyServerState(stateData);
        } catch {
            // Ignore reload failures; realtime/polling can recover later.
        }
    };


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
                
                // If the session is already completed, violently eject the user to the dashboard
                if (stateRes.status === 410 || stateData?.status === "completed") {
                    window.location.href = "/dashboard";
                    return;
                }

                if (stateRes.ok && stateData) {
                    applyServerState(stateData);
                }
            } catch {
                // Ignore network errors on init
            }
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
                    
                    if (res.status === 410) {
                        window.location.href = "/dashboard";
                        return;
                    }

                    if (res.ok) {
                        const stateData = await res.json();
                        if (stateData?.status === "completed") {
                            window.location.href = "/dashboard";
                            return;
                        }
                        
                        if (stateData) {
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
                            if (typeof stateData.problemTitle === "string") {
                                setProblemTitle(prev => stateData.problemTitle !== prev ? stateData.problemTitle : prev);
                            }
                            if (typeof stateData.problemId === "string") {
                                setProblemId(prev => stateData.problemId !== prev ? stateData.problemId : prev);
                            }
                            if (typeof stateData.sampleTests === "string") {
                                setSampleTests(prev => stateData.sampleTests !== prev ? stateData.sampleTests : prev);
                            }
                            if (typeof stateData.privateTests === "string") {
                                setPrivateTests(prev => stateData.privateTests !== prev ? stateData.privateTests : prev);
                            }
                            if (typeof stateData.interviewerNotes === "string") {
                                setInterviewerNotes(prev => stateData.interviewerNotes !== prev ? stateData.interviewerNotes : prev);
                            }
                            if (typeof stateData.version === "number" && stateData.version !== stateVersionRef.current) {
                                setStateVersion(stateData.version);
                                stateVersionRef.current = stateData.version;
                            }
                            if (stateData.timerState) {
                                setTimerState(prev => JSON.stringify(stateData.timerState) !== JSON.stringify(prev) ? stateData.timerState : prev);
                            }
                            // Sync stored execution result if available
                            if (stateData.lastOutput) {
                                setExecutionResult((prev: any) => {
                                    // Deep equality check is expensive, simple JSON stringify check
                                    if (JSON.stringify(prev) !== JSON.stringify(stateData.lastOutput)) {
                                        return stateData.lastOutput;
                                    }
                                    return prev;
                                });
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
        const channel = supabase.channel(getInterviewStateChannel(sessionId));
        channelRef.current = channel;

        channel.on("broadcast", { event: "state" }, (payload: any) => {
            const { clientId: senderClientId, language: newLang, codeMap: newCodeMap, driverMap: newDriverMap, problemText: newProb, problemTitle: newTitle, problemId: newProblemId, sampleTests: newTests, cursor, version } = payload?.payload || {};

            // Echo cancellation: only skip if it's from THIS exact client
            if (senderClientId && senderClientId === clientIdRef.current) {
                return;
            }

            // Removed timestamp clock-sync check because it relies on local system time 
            // which can differ between clients, causing valid messages to be dropped.

            // Update state from broadcast

            // 1. Language Update
            if (newLang) {
                setLanguage(newLang);
            }

            // 2. Code Update (Patch) - OPTIMIZED
            if (newCodeMap) {
                // Reduced debounce to 50ms for sub-100ms perceived latency
                // Just enough to prevent local-echo loops, but fast enough for collaboration
                const timeSinceLastEdit = Date.now() - lastLocalEditRef.current;

                if (senderClientId !== clientIdRef.current && timeSinceLastEdit > 50) {
                    setCodeMap(prev => {
                        // Merge logic: only update if actual change
                        let hasChange = false;
                        for (const k of Object.keys(newCodeMap)) {
                            if (newCodeMap[k] !== prev[k]) { hasChange = true; break; }
                        }
                        if (!hasChange) return prev;
                        return { ...prev, ...newCodeMap };
                    });

                    // Update Last Editor Indicator
                    const p = payload?.payload as any;
                    if (p?.role) {
                        setLastEditor({
                            name: p.userId || "Peer",
                            role: p.role,
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
            if (typeof newTitle === "string") {
                setProblemTitle(newTitle);
            }
            if (typeof newProblemId === "string") {
                setProblemId(newProblemId);
            }
            if (typeof newTests === "string") {
                setSampleTests(newTests);
            }
            if (payload?.payload?.privateTests && typeof payload.payload.privateTests === "string") {
                setPrivateTests(payload.payload.privateTests);
            }

            // 4. Cursor Update
            if (cursor && senderClientId) {
                setRemoteCursors(prev => ({ ...prev, [senderClientId]: cursor }));
            }

            // 5. Freeze State Update
            if (payload?.payload?.isFrozen !== undefined) {
                setIsFrozen(payload.payload.isFrozen);
            }

            // 6. Timer Update
            if (payload?.payload?.timerState !== undefined) {
                setTimerState(payload.payload.timerState);
            }

            if (typeof version === "number" && version > stateVersionRef.current) {
                setStateVersion(version);
                stateVersionRef.current = version;
            }

            // 7. Last Output Update (from persist patch, fallback for broadcast)
            if (payload?.payload?.lastOutput) {
                setExecutionResult(payload.payload.lastOutput);
            }
        });

        channel.on("broadcast", { event: "execution_result" }, (payload: any) => {
            console.log("📨 Received execution result broadcast");
            setExecutionResult(payload.payload);
        });

        channel.on("broadcast", { event: "session_ended" }, () => {
            console.warn("⚠️ Session ended by interviewer");
            window.location.href = "/dashboard";
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
        pendingCursorRef.current = position;
        
        if (cursorBroadcastTimeout.current) clearTimeout(cursorBroadcastTimeout.current);
        
        cursorBroadcastTimeout.current = setTimeout(() => {
            if (channelRef.current) {
                const pos = pendingCursorRef.current;
                channelRef.current.send({
                    type: "broadcast",
                    event: "state",
                    payload: {
                        clientId: clientIdRef.current,
                        cursor: { ...pos, userId, timestamp: Date.now() }
                    }
                }).catch(() => { });
            }
        }, 400);
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
                timestamp,
                version: stateVersionRef.current + 1
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
            }

        }, 400);
    };

    const broadcastExecutionResult = (result: any) => {
        if (!channelRef.current) {
            console.warn("⚠️ Channel not ready for execution broadcast");
            return;
        }

        // Immediate send, no debounce for results
        channelRef.current.send({
            type: "broadcast",
            event: "execution_result",
            payload: result
        }).then(() => {
            console.log("✅ Execution result broadcast successfully");
        }).catch((e: any) => {
            console.error("❌ Execution result broadcast failed:", e);
        });

        // ALSO persist to DB for reliability
        persist({ lastOutput: result });
    };

    const persist = (patch: any) => {
        pendingPersistRef.current = { ...pendingPersistRef.current, ...patch };
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
            try {
                const payloadToPersist = { ...pendingPersistRef.current };
                pendingPersistRef.current = {};
                const res = await fetch("/api/interview/state", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, baseVersion: stateVersionRef.current, ...payloadToPersist }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (typeof data.version === "number") {
                        setStateVersion(data.version);
                        stateVersionRef.current = data.version;
                    }
                    if (typeof data.interviewerNotes === "string") {
                        setInterviewerNotes(data.interviewerNotes);
                    }
                } else if (res.status === 409) {
                    await reloadAuthoritativeState();
                }
            } catch { }
        }, 1000);
    };

    const persistInterviewerNotes = (notes: string) => {
        setInterviewerNotes(notes);
        if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
        notesSaveTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch("/api/interview/state", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId,
                        interviewerNotes: notes,
                        baseVersion: stateVersionRef.current,
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (typeof data.interviewerNotes === "string") {
                        setInterviewerNotes(data.interviewerNotes);
                    }
                    if (typeof data.version === "number") {
                        setStateVersion(data.version);
                        stateVersionRef.current = data.version;
                    }
                }
            } catch {
                // Ignore note persistence failures and allow retry on next edit.
            }
        }, 500);
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

    const updateProblemTitle = (title: string) => {
        setProblemTitle(title);
        broadcast({ problemTitle: title });
        persist({ problemTitle: title });
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

    const toggleFreeze = () => {
        const newState = !isFrozen;
        setIsFrozen(newState);
        broadcast({ isFrozen: newState });
        persist({ isFrozen: newState });
    };

    const updateTimerState = (newState: { active: boolean, startTimestamp: number | null, accumulated: number }) => {
        setTimerState(newState);
        broadcast({ timerState: newState });
        persist({ timerState: newState });
    };

    const resetSessionForNextQuestion = () => {
        const newProblemId = Math.random().toString(36).substring(2, 15);
        
        const resetPatch = {
            problemId: newProblemId,
            problemTitle: "Next Problem",
            problemText: "",
            sampleTests: "",
            privateTests: "",
            codeMap: {
                javascript: "// Start coding new problem...\n",
                java: "// Start coding new problem...\n",
                cpp: "// Start coding new problem...\n"
            },
            driverMap: {},
            lastOutput: null,
            timerState: { active: false, startTimestamp: null, accumulated: 0 }
        };

        setProblemId(newProblemId);
        setProblemTitle(resetPatch.problemTitle);
        setProblemText(resetPatch.problemText);
        setSampleTests(resetPatch.sampleTests);
        setPrivateTests(resetPatch.privateTests);
        setCodeMap(resetPatch.codeMap);
        setDriverMap(resetPatch.driverMap);
        setExecutionResult(null);
        setTimerState(resetPatch.timerState);

        broadcast(resetPatch);
        persist(resetPatch);
    };

    const endSession = async () => {
        // Broadcast first so others leave
        if (channelRef.current && channelRef.current.state === 'joined') {
            await channelRef.current.send({
                type: "broadcast",
                event: "session_ended",
                payload: {}
            });
        }

        // Call API to close
        await fetch(`/api/session/${sessionId}/end`, { method: "POST" });
        window.location.href = "/dashboard";
    };

    return {
        language,
        code,
        codeMap,
        problemId,
        problemText,
        problemTitle,
        sampleTests,
        privateTests,
        driver,
        driverMap,
        role,
        interviewerNotes,
        showAuthModal,
        setShowAuthModal,
        setPrivateTests: (text: string) => {
            setPrivateTests(text);
            broadcast({ privateTests: text });
            persist({ privateTests: text });
        },
        updateLanguage,
        updateCode,
        setCodeMapFull,
        setDriverMapFull,
        updateProblemText,
        updateProblemTitle,
        updateSampleTests,
        updateDriver,
        broadcast,
        persist,
        executionResult,
        broadcastExecutionResult,
        remoteCursors,
        broadcastCursor,
        isFrozen,
        toggleFreeze,
        timerState,
        updateTimerState,
        lastEditor,
        stateVersion,
        persistInterviewerNotes,
        resetSessionForNextQuestion,
        endSession
    };
}
