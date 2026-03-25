import { redis } from "@/lib/redis";

const QUEUE_KEY = "matchmaking:queue";
const STALE_AFTER_MS = 60 * 1000;

export async function enqueue(userId: string) {
  const now = Date.now();
  await redis.zadd(QUEUE_KEY, "NX", now, userId);
  await redis.zremrangebyscore(QUEUE_KEY, 0, now - STALE_AFTER_MS);
}

export async function tryMatch() {
  const now = Date.now();
  await redis.zremrangebyscore(QUEUE_KEY, 0, now - STALE_AFTER_MS);

  const users = await redis.zrange(QUEUE_KEY, 0, 1);
  if (users.length < 2) return null;

  await redis.zrem(QUEUE_KEY, ...users);
  return [users[0], users[1]] as [string, string];
}
