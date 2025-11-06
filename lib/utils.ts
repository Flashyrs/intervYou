import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Generates a short random session ID
 */
export function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Type definition for session with user
 */
export type SessionWithUser = {
  user: {
    id: string;
    email?: string;
    name?: string;
  };
  [key: string]: any; // extra properties returned by next-auth
};

/**
 * Requires a logged-in session
 */
export async function requireAuth(): Promise<SessionWithUser> {
  const session = await getServerSession(authOptions as any);

  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }

  return session as SessionWithUser;
}

/**
 * Classnames merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
