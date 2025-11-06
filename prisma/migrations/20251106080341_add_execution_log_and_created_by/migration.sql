/*
  Warnings:

  - Added the required column `createdBy` to the `InterviewSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExecutionLog_sessionId_userId_idx" ON "ExecutionLog"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "ExecutionLog_sessionId_userId_problemId_idx" ON "ExecutionLog"("sessionId", "userId", "problemId");
