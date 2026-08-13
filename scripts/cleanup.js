const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config();

async function run() {
    console.log("Starting database cleanup for stress-test fixtures...");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        // Delete rooms
        const deletedRooms = await prisma.interviewSession.deleteMany({
            where: { id: { startsWith: "stress-test-" } }
        });
        console.log(`Deleted ${deletedRooms.count} temporary rooms.`);

        // Delete users
        const deletedUsers = await prisma.user.deleteMany({
            where: { id: { startsWith: "stress-test-" } }
        });
        console.log(`Deleted ${deletedUsers.count} temporary users.`);
    } catch (err) {
        console.error("Cleanup failed:", err);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
