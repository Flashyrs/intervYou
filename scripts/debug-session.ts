import { Redis } from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function main() {
    const sessionId = 'cmkpyaqzm0007v8ilcs5hrf5r';
    console.log(`Fetching state for session: ${sessionId}`);
    const stateStr = await redis.get(`session:${sessionId}:state`);
    const state = stateStr ? JSON.parse(stateStr) : {};
    console.log(JSON.stringify(state, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await redis.quit();
    });
