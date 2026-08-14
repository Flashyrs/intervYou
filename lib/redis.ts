import { Redis } from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

const client =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
  });

globalForRedis.redis = client;

// Self-closing connection logic for Serverless environments
let idleTimeout: NodeJS.Timeout | null = null;

function resetIdleTimeout() {
    if (idleTimeout) clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        if (client.status === 'ready' || client.status === 'connecting') {
            console.log("🔌 Redis idle timeout reached. Closing connection to free resources.");
            client.disconnect();
        }
    }, 1000); // Disconnect after 1 second of inactivity
}

// Intercept ioredis internal command sender to reset idle timer on any Redis operation
const originalSendCommand = (client as any).sendCommand;
if (originalSendCommand) {
    (client as any).sendCommand = function (command: any, ...args: any[]) {
        resetIdleTimeout();
        return originalSendCommand.call(client, command, ...args);
    };
}

export const redis = client;
