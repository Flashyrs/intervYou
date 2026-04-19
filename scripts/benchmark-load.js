const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const SESSION_ID = process.argv[2] || "perf-test-" + Math.random().toString(36).substring(7);
const CONCURRENCY = parseInt(process.argv[3]) || 5;
const DURATION_MS = 10000;

// Supabase Free Tier allows 10 messages per second.
// Each simulated user sends 2 pings/sec (every 500ms).
const totalMsgsPerSec = CONCURRENCY * 2;

console.log(`🚀 Starting Load Test on session: ${SESSION_ID}`);
console.log(`👥 Concurrency: ${CONCURRENCY} virtual users (~${totalMsgsPerSec} msgs/sec)`);

if (totalMsgsPerSec > 10) {
    console.warn("⚠️  WARNING: You are exceeding the 10 msg/sec limit for Supabase Free Tier.");
    console.warn("   This will likely cause the connection to drop and fall back to REST (0% success).");
    console.warn("   Recommended max concurrency for Free Tier: 5 users.\n");
}

const results = [];
let totalSent = 0;
let totalReceived = 0;

async function spawnUser(id) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    // Align with getInterviewStateChannel() in lib/sessionChannels.ts
    const channel = supabase.channel(`interview-state-${SESSION_ID}`);

    channel.on("broadcast", { event: "diagnostic_pong" }, (payload) => {
        // Echo cancellation happens in payload check or client filtering
        const rtt = Date.now() - payload.payload.startTs;
        results.push(rtt / 2);
        totalReceived++;
    });

    await new Promise((resolve, reject) => {
        channel.subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            if (status === "CHANNEL_ERROR") reject();
        });
    });

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            channel.send({
                type: "broadcast",
                event: "diagnostic_ping",
                payload: { startTs: Date.now(), userId: id }
            });
            totalSent++;
        }, 500); 

        setTimeout(() => {
            clearInterval(interval);
            supabase.removeChannel(channel).then(() => resolve());
        }, DURATION_MS);
    });
}

function calculatePercentile(data, p) {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[index]);
}

async function run() {
    const users = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        users.push(spawnUser(i));
    }

    await Promise.all(users);
    
    await new Promise(r => setTimeout(r, 1000));

    console.log("\n--- 📊 Performance Report ---");
    console.log(`Total Sent: ${totalSent}`);
    console.log(`Total Received: ${totalReceived}`);
    const rate = totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0;
    console.log(`Success Rate: ${rate}%`);
    console.log(`p50 Latency: ${calculatePercentile(results, 50)}ms`);
    console.log(`p95 Latency: ${calculatePercentile(results, 95)}ms`);
    console.log(`p99 Latency: ${calculatePercentile(results, 99)}ms`);
    console.log("-----------------------------\n");
    
    if (results.length > 0) {
        console.log("👉 VERDICT: " + (calculatePercentile(results, 50) < 100 ? "PASS ✅" : "FAIL ❌"));
    }
    process.exit(0);
}

run();
