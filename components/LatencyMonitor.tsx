"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export function LatencyMonitor() {
    const [latency, setLatency] = useState<number | null>(null);

    useEffect(() => {
        const checkLatency = async () => {
            const start = Date.now();
            try {
                const res = await fetch("/api/ping", { cache: "no-store" });
                if (res.ok) {
                    const end = Date.now();
                    setLatency(end - start);
                }
            } catch (error) {
                console.error("Latency check failed", error);
            }
        };

        checkLatency();
        const interval = setInterval(checkLatency, 2000);
        return () => clearInterval(interval);
    }, []);

    // Calculate and log average ping for resume/debugging
    useEffect(() => {
        if (latency !== null) {
            const history = (window as any).__pingHistory || [];
            history.push(latency);
            (window as any).__pingHistory = history;

            if (history.length % 10 === 0) {
                const sum = history.reduce((a: number, b: number) => a + b, 0);
                const avg = Math.round(sum / history.length);
                console.log(`🏓 Average Ping (n=${history.length}): ${avg}ms`);
            }
        }
    }, [latency]);

    if (latency === null) return null;

    let colorClass = "text-green-500";
    if (latency > 150) colorClass = "text-yellow-500";
    if (latency > 300) colorClass = "text-red-500";

    return (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-full shadow-sm text-xs font-mono transition-opacity hover:opacity-100 opacity-70">
            <Activity className={`w-3.5 h-3.5 ${colorClass}`} />
            <span className={colorClass}>{latency}ms</span>
        </div>
    );
}
