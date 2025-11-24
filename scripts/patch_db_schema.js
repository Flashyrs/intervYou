const { Pool } = require('pg');
require('dotenv').config();

async function patchDatabase() {
    console.log('Connecting to database...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const client = await pool.connect();
        console.log('Connected successfully.');

        const queries = [
            // Add columns
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN DEFAULT false;`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "inviteeEmail" TEXT;`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "participantJoinedAt" JSONB;`,
            `ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "participantLeftAt" JSONB;`,

            // Add indices
            `CREATE INDEX IF NOT EXISTS "InterviewSession_status_idx" ON "InterviewSession"("status");`,
            `CREATE INDEX IF NOT EXISTS "InterviewSession_scheduledFor_idx" ON "InterviewSession"("scheduledFor");`
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await client.query(query);
        }

        console.log('Database patch completed successfully.');
        client.release();
    } catch (err) {
        console.error('Error patching database:', err);
    } finally {
        await pool.end();
    }
}

patchDatabase();
