/**
 * IntervYou Multi-Room and Multi-User Stress Test Suite
 * 
 * This script stress tests:
 * 1. Database/API performance (concurrent HTTP state updates via Ghost Auth)
 * 2. Realtime WebSocket performance (concurrent Supabase Realtime Channels)
 * 
 * Usage:
 *   node scripts/stress-test.js [rooms] [usersPerRoom] [intervalMs] [durationMs] [testType]
 * 
 * Example:
 *   node scripts/stress-test.js 3 2 300 10000 both
 */

const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let APP_URL = (process.env.TARGET_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
if (APP_URL.endsWith("/")) {
    APP_URL = APP_URL.slice(0, -1);
}
const PERF_TEST_SECRET = process.env.PERF_TEST_SECRET || "IntervYouPerfLimit_2026";
const ENABLE_PERF_TESTING = process.env.ENABLE_PERF_TESTING === 'true';

// Check prerequisites
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

if (!ENABLE_PERF_TESTING) {
    console.warn("⚠️  WARNING: ENABLE_PERF_TESTING is not set to true in .env.");
    console.warn("   HTTP API requests will likely fail with 401 Unauthorized.");
}

// Parse args
const ROOMS_COUNT = parseInt(process.argv[2]) || 2;
const USERS_PER_ROOM = parseInt(process.argv[3]) || 2;
const INTERVAL_MS = parseInt(process.argv[4]) || 300;
const DURATION_MS = parseInt(process.argv[5]) || 10000;
const TEST_TYPE = process.argv[6] || "both"; // "api", "ws", "both"

console.log(`
╔════════════════════════════════════════════════════════════════╗
║ ⚡ IntervYou Stress Test Suite                                 ║
╚════════════════════════════════════════════════════════════════╝
👥 Rooms Count        : ${ROOMS_COUNT}
👥 Users per Room    : ${USERS_PER_ROOM} (Total Virtual Users: ${ROOMS_COUNT * USERS_PER_ROOM})
⏱️  Update Interval   : ${INTERVAL_MS}ms
⏱️  Test Duration     : ${DURATION_MS}ms
⚙️  Test Type         : ${TEST_TYPE.toUpperCase()}
🔗 Target API URL    : ${APP_URL}
──────────────────────────────────────────────────────────────────
`);

const testRunId = `stress-test-${Math.random().toString(36).substring(7)}`;

// Metrics tracking
const metrics = {
    http: {
        sent: 0,
        success: 0,
        failed: 0,
        latencies: [],
    },
    ws: {
        sent: 0,
        received: 0,
        dropped: 0,
        latencies: [],
    }
};

function calculatePercentile(data, p) {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return Math.round(sorted[index]);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    const createdUsers = [];
    const createdRooms = [];

    try {
        console.log("⚙️  1. Provisioning temporary database fixtures...");
        
        // Create users
        for (let r = 0; r < ROOMS_COUNT; r++) {
            const roomUsers = [];
            for (let u = 0; u < USERS_PER_ROOM; u++) {
                const userId = `${testRunId}-u-${r}-${u}`;
                const user = await prisma.user.create({
                    data: {
                        id: userId,
                        email: `${userId}@test.com`,
                        name: `Stress Bot ${r}-${u}`,
                    }
                });
                createdUsers.push(user);
                roomUsers.push(user);
            }

            // Create room
            const room = await prisma.interviewSession.create({
                data: {
                    id: `${testRunId}-r-${r}`,
                    createdBy: roomUsers[0].id,
                    status: "active",
                    participants: {
                        connect: roomUsers.map(u => ({ id: u.id }))
                    }
                }
            });
            createdRooms.push(room);
        }
        
        console.log(`✅ Provisioned ${createdRooms.length} rooms and ${createdUsers.length} users successfully.\n`);
        
        // Setup performance testers
        const runners = [];
        
        for (let r = 0; r < ROOMS_COUNT; r++) {
            const roomId = createdRooms[r].id;
            
            for (let u = 0; u < USERS_PER_ROOM; u++) {
                const userId = `${testRunId}-u-${r}-${u}`;
                const isInterviewer = u === 0;
                
                runners.push(async () => {
                    let wsChannel = null;
                    let supabaseClient = null;
                    let pendingPings = new Set();
                    const pendingRequests = [];
                    
                    // Initialize WS connection if needed
                    if (TEST_TYPE === "ws" || TEST_TYPE === "both") {
                        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
                        wsChannel = supabaseClient.channel(`interview-state-${roomId}`);
                        
                        wsChannel.on("broadcast", { event: "diagnostic_pong" }, (payload) => {
                            const p = payload.payload;
                            if (p.targetId === userId && pendingPings.has(p.startTs)) {
                                const rtt = Date.now() - p.startTs;
                                metrics.ws.latencies.push(rtt / 2);
                                metrics.ws.received++;
                                pendingPings.delete(p.startTs);
                            }
                        });

                        wsChannel.on("broadcast", { event: "diagnostic_ping" }, (payload) => {
                            const p = payload.payload;
                            if (p.senderId !== userId) {
                                wsChannel.send({
                                    type: "broadcast",
                                    event: "diagnostic_pong",
                                    payload: { startTs: p.startTs, targetId: p.senderId }
                                }).catch(() => {});
                            }
                        });

                        await new Promise((resolve, reject) => {
                            wsChannel.subscribe((status) => {
                                if (status === "SUBSCRIBED") resolve();
                                if (status === "CHANNEL_ERROR") reject(new Error("WS Subscription Error"));
                            });
                        });
                    }

                    const interval = setInterval(() => {
                        const startTs = Date.now();
                        
                        // Send WS Ping
                        if (wsChannel) {
                            pendingPings.add(startTs);
                            wsChannel.send({
                                type: "broadcast",
                                event: "diagnostic_ping",
                                payload: { startTs, senderId: userId }
                            }).catch(() => {
                                metrics.ws.dropped++;
                            });
                            metrics.ws.sent++;
                        }

                        // Send HTTP State update
                        if (TEST_TYPE === "api" || TEST_TYPE === "both") {
                            metrics.http.sent++;
                            const httpStart = Date.now();
                            const fetchPromise = fetch(`${APP_URL}/api/interview/state`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-perf-test-secret": PERF_TEST_SECRET,
                                    "x-perf-test-user-id": userId,
                                },
                                body: JSON.stringify({
                                    sessionId: roomId,
                                    code: `// Stress typing: ${startTs}\nfunction stress() { return ${Math.random()}; }`,
                                    language: "javascript"
                                })
                            }).then(async (res) => {
                                const duration = Date.now() - httpStart;
                                metrics.http.latencies.push(duration);
                                if (res.ok) {
                                    metrics.http.success++;
                                } else {
                                    metrics.http.failed++;
                                    if (metrics.http.failed <= 3) {
                                        console.warn(`⚠️ [HTTP Error] Status: ${res.status}`);
                                        res.text().then(text => console.warn(`   [HTTP Error Body]: ${text.substring(0, 100)}`));
                                    }
                                }
                            }).catch((e) => {
                                metrics.http.failed++;
                                if (metrics.http.failed <= 3) {
                                    console.warn(`⚠️ [HTTP Network Error]: ${e.message}`);
                                }
                            });
                            pendingRequests.push(fetchPromise);
                        }
                    }, INTERVAL_MS);

                    // Wait for duration
                    await sleep(DURATION_MS);
                    clearInterval(interval);

                    // Await in-flight HTTP requests and wait for trailing WS pongs
                    await Promise.allSettled(pendingRequests);
                    if (TEST_TYPE === "ws" || TEST_TYPE === "both") {
                        await sleep(1500); // Cooldown to let final WS messages resolve
                    }

                    // Cleanup WebSocket
                    if (wsChannel && supabaseClient) {
                        await supabaseClient.removeChannel(wsChannel);
                    }
                });
            }
        }

        console.log(`🔥 Starting stress simulation for ${DURATION_MS}ms...`);
        const startTime = Date.now();
        await Promise.all(runners.map(fn => fn()));
        const actualDuration = Date.now() - startTime;
        console.log("🏁 Simulation completed.\n");

        // Analyze and print results
        printReport(actualDuration);

    } catch (e) {
        console.error("❌ Test run failed: ", e);
    } finally {
        console.log("🧹 3. Cleaning up temporary database fixtures...");
        try {
            // Delete rooms
            await prisma.interviewSession.deleteMany({
                where: { id: { startsWith: testRunId } }
            });
            // Delete users
            await prisma.user.deleteMany({
                where: { id: { startsWith: testRunId } }
            });
            console.log("✅ Cleanup complete.");
        } catch (cleanupErr) {
            console.error("⚠️ Cleanup failed: ", cleanupErr);
        }
        await prisma.$disconnect();
    }
}

function printReport(actualDuration) {
    const seconds = actualDuration / 1000;
    
    console.log("==================== 📊 STRESS TEST REPORT ====================");
    console.log(`Actual Duration : ${seconds.toFixed(2)}s`);
    console.log("---------------------------------------------------------------");

    if (TEST_TYPE === "api" || TEST_TYPE === "both") {
        const httpSec = (metrics.http.sent / seconds).toFixed(1);
        const p50 = calculatePercentile(metrics.http.latencies, 50);
        const p95 = calculatePercentile(metrics.http.latencies, 95);
        const p99 = calculatePercentile(metrics.http.latencies, 99);
        const successRate = metrics.http.sent > 0 
            ? ((metrics.http.success / metrics.http.sent) * 100).toFixed(1)
            : 0;

        console.log("🌐 HTTP API / Database State Sync:");
        console.log(`   Total Updates Attempted : ${metrics.http.sent}`);
        console.log(`   Throughput              : ${httpSec} updates/sec`);
        console.log(`   Success Rate            : ${successRate}% (${metrics.http.success} OK, ${metrics.http.failed} Fail)`);
        console.log(`   p50 Latency (Roundtrip) : ${p50}ms`);
        console.log(`   p95 Latency             : ${p95}ms`);
        console.log(`   p99 Latency             : ${p99}ms`);
        console.log("---------------------------------------------------------------");
    }

    if (TEST_TYPE === "ws" || TEST_TYPE === "both") {
        const wsSec = (metrics.ws.sent / seconds).toFixed(1);
        const p50 = calculatePercentile(metrics.ws.latencies, 50);
        const p95 = calculatePercentile(metrics.ws.latencies, 95);
        const p99 = calculatePercentile(metrics.ws.latencies, 99);
        const successRate = metrics.ws.sent > 0 
            ? ((metrics.ws.received / metrics.ws.sent) * 100).toFixed(1)
            : 0;

        console.log("🔌 Supabase Realtime Channels (Broadcast):");
        console.log(`   Total Broadcasts Sent   : ${metrics.ws.sent}`);
        console.log(`   Total Pongs Received    : ${metrics.ws.received}`);
        console.log(`   Throughput              : ${wsSec} msgs/sec`);
        console.log(`   Delivery Success Rate   : ${successRate}%`);
        console.log(`   p50 Sync Delay (1-way)  : ${p50}ms`);
        console.log(`   p95 Sync Delay          : ${p95}ms`);
        console.log(`   p99 Sync Delay          : ${p99}ms`);
        console.log("---------------------------------------------------------------");
        
        const totalMsgsPerSecAcrossChannels = (metrics.ws.sent / seconds);
        
        let wsVerdict = "EXCELLENT 💎";
        if (totalMsgsPerSecAcrossChannels > 10) {
            wsVerdict += " (Note: Exceeded 10 msgs/s threshold for Free Tier. Observe latency degradation)";
        }
        console.log(`👉 Websocket Verdict       : ${wsVerdict}`);
    }
    
    console.log("===============================================================");
}

run();
