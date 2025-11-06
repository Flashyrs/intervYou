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
    throw new Error("Unauthorized");
  }

  return session;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
