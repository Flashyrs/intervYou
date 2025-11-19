/*
  Warnings:

  - Changed the type of `results` on the `Submission` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "results",
ADD COLUMN     "results" JSONB NOT NULL;

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
CREATE UNIQUE INDEX "ExecutionLog_sessionId_userId_problemId_key" ON "ExecutionLog"("sessionId", "userId", "problemId");
