import { useState, useEffect, useRef, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type PerformanceMetrics = {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    samples: number;
    msgsPerSec: number;
    recoveryTime: number | null;
    failureRate: number;
};

export function usePerformanceProber(channel: RealtimeChannel | null, isConnected: boolean) {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        p50: 0,
        p95: 0,
        p99: 0,
        avg: 0,
        samples: 0,
        msgsPerSec: 0,
        recoveryTime: null,
        failureRate: 0,
    });

    const samplesRef = useRef<number[]>([]);
    const msgCountRef = useRef(0);
    const connectionStartRef = useRef<number | null>(null);
    const failCountRef = useRef(0);
    const totalMsgRef = useRef(0);

    const calculatePercentile = (data: number[], percentile: number) => {
        if (data.length === 0) return 0;
        const sorted = [...data].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    };

    const probe = useCallback(() => {
        if (!channel || !isConnected) return;

        const startTs = Date.now();
        channel.send({
            type: "broadcast",
            event: "diagnostic_ping",
            payload: { startTs }
        }).catch(() => {
            failCountRef.current++;
        });
        totalMsgRef.current++;
    }, [channel, isConnected]);

    useEffect(() => {
        if (!channel) return;

        const onPong = (payload: any) => {
            const endTs = Date.now();
            const rtt = endTs - payload.payload.startTs;
            const latency = rtt / 2; // Peer-to-Peer estimate
            
            samplesRef.current.push(latency);
            if (samplesRef.current.length > 100) samplesRef.current.shift(); // Keep last 100 samples

            const samples = samplesRef.current;
            const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
            
            setMetrics(prev => ({
                ...prev,
                p50: calculatePercentile(samples, 50),
                p95: calculatePercentile(samples, 95),
                p99: calculatePercentile(samples, 99),
                avg,
                samples: samples.length,
                failureRate: Math.round((failCountRef.current / totalMsgRef.current) * 100) || 0
            }));
        };

        const onPing = (payload: any) => {
            channel.send({
                type: "broadcast",
                event: "diagnostic_pong",
                payload: { startTs: payload.payload.startTs }
            });
        };

        const pingSub = channel.on("broadcast", { event: "diagnostic_ping" }, onPing);
        const pongSub = channel.on("broadcast", { event: "diagnostic_pong" }, onPong);

        // Throughput monitoring
        const interval = setInterval(() => {
            setMetrics(prev => ({
                ...prev,
                msgsPerSec: msgCountRef.current,
            }));
            msgCountRef.current = 0;
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [channel]);

    // Track messages per second
    useEffect(() => {
        if (!channel) return;
        const sub = (payload: any) => {
            msgCountRef.current++;
        };
        channel.on("broadcast", { event: "*" }, sub);
    }, [channel]);

    // Connection lifecycle
    useEffect(() => {
        if (!isConnected) {
            connectionStartRef.current = Date.now();
        } else if (connectionStartRef.current) {
            const recoveryTime = Date.now() - connectionStartRef.current;
            setMetrics(prev => ({ ...prev, recoveryTime }));
            connectionStartRef.current = null;
            console.log(`[Perf] Recovery Time: ${recoveryTime}ms`);
        }
    }, [isConnected]);

    // Run periodic probes
    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(probe, 2000);
        return () => clearInterval(interval);
    }, [isConnected, probe]);

    return metrics;
}
