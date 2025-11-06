import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function generateSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function requireAuth() {
  const session = await getServerSession(authOptions as any);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}