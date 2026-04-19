import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type SessionWithUser = {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  [key: string]: any; 
};



export async function requireAuth(): Promise<SessionWithUser> {
  const session = (await getServerSession(authOptions)) as SessionWithUser | null;

  if (!session?.user) {
    // Ghost Auth Bypass for Performance Testing
    const headerPayload = (await import('next/headers')).headers();
    const ghostSecret = headerPayload.get("x-perf-test-secret");
    const ghostUserId = headerPayload.get("x-perf-test-user-id");
    
    const isPerfTestingEnabled = process.env.ENABLE_PERF_TESTING === 'true';
    
    if (isPerfTestingEnabled && ghostSecret === process.env.PERF_TEST_SECRET && ghostUserId) {
      console.log(`[GhostAuth] Bypassing auth for user: ${ghostUserId}`);
      return {
        user: {
          id: ghostUserId,
          email: `${ghostUserId}@ghost.test`,
          name: `Ghost ${ghostUserId.substring(0, 4)}`
        }
      };
    }

    throw new Error("Unauthorized");
  }

  return session;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
