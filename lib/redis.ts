import { Redis } from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

// Vercel build processes execute imports but don't have access to your live Redis server.
// `lazyConnect: true` prevents ioredis from aggressively crashing the build step.
export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
