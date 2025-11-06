import { PrismaClient } from "@prisma/client";

export const prisma = (globalThis as any).prisma || new PrismaClient(); if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;

export function getPrisma() {  const g = globalThis as any;  if (!g.prisma) g.prisma = new PrismaClient();  return g.prisma as PrismaClient; }