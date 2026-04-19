"use client";

import { useEffect, useState } from "react";
import { Activity, Zap, Clock, Gauge, AlertCircle } from "lucide-react";
import type { PerformanceMetrics } from "@/hooks/usePerformanceProber";

interface DiagnosticsOverlayProps {
    metrics: PerformanceMetrics;
}

export function DiagnosticsOverlay({ metrics }: DiagnosticsOverlayProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [httpLatency, setHttpLatency] = useState<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey && e.key === "D") {
                setIsVisible(prev => !prev);
            }
        };
        
        const isDiagnosticsEnabled = process.env.NEXT_PUBLIC_SHOW_DIAGNOSTICS === 'true';
        if (!isDiagnosticsEnabled) return;

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const isDiagnosticsEnabled = process.env.NEXT_PUBLIC_SHOW_DIAGNOSTICS === 'true';
    if (!isDiagnosticsEnabled) return null;

    if (!isVisible) return (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[10px] text-gray-400 font-mono border border-white/10 pointer-events-none opacity-50">
            Shift+D for Diagnostics
        </div>
    );

    return (
        <div className="fixed bottom-4 left-4 z-50 w-64 bg-gray-900/90 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-4 text-white font-mono transition-all duration-300 transform scale-100 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Perf Shield</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${metrics.samples > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </div>

            <div className="space-y-3">
                <MetricRow 
                    icon={<Activity className="w-3.5 h-3.5 text-blue-400" />} 
                    label="Sync p50" 
                    value={`${metrics.p50}ms`} 
                    color={getLatencyColor(metrics.p50)}
                />
                <MetricRow 
                    icon={<Activity className="w-3.5 h-3.5 text-indigo-400" />} 
                    label="Sync p95" 
                    value={`${metrics.p95}ms`} 
                    color={getLatencyColor(metrics.p95)}
                />
                <MetricRow 
                    icon={<Activity className="w-3.5 h-3.5 text-purple-400" />} 
                    label="Sync p99" 
                    value={`${metrics.p99}ms`} 
                    color={getLatencyColor(metrics.p99)}
                />
                <div className="h-px bg-white/5 my-2" />
                <MetricRow 
                    icon={<Clock className="w-3.5 h-3.5 text-emerald-400" />} 
                    label="Recovery" 
                    value={metrics.recoveryTime ? `${metrics.recoveryTime}ms` : "---"} 
                />
                <MetricRow 
                    icon={<Gauge className="w-3.5 h-3.5 text-orange-400" />} 
                    label="Throughput" 
                    value={`${metrics.msgsPerSec} m/s`} 
                />
                 <MetricRow 
                    icon={<AlertCircle className="w-3.5 h-3.5 text-red-400" />} 
                    label="Failure" 
                    value={`${metrics.failureRate}%`} 
                    color={metrics.failureRate > 0 ? "text-red-400" : "text-green-400"}
                />
                 <MetricRow 
                    icon={<Zap className="w-3.5 h-3.5 text-gray-400" />} 
                    label="HTTP Ping" 
                    value={httpLatency ? `${httpLatency}ms` : "---"} 
                />
            </div>

            <div className="mt-4 pt-2 border-t border-white/10 text-[9px] text-gray-500 flex justify-between">
                <span>Samples: {metrics.samples}</span>
                <span>Active Broadcast</span>
            </div>
        </div>
    );
}

function MetricRow({ icon, label, value, color = "text-gray-300" }: { icon: any, label: string, value: string, color?: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-gray-500">
                {icon}
                <span>{label}</span>
            </div>
            <span className={`font-bold ${color}`}>{value}</span>
        </div>
    );
}

function getLatencyColor(ms: number) {
    if (ms < 50) return "text-green-400";
    if (ms < 150) return "text-yellow-400";
    return "text-red-400";
}
