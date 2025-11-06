/*
  Warnings:

  - You are about to drop the `ExecutionLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InterviewSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InterviewState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_InterviewSessionToUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[token]` on the table `VerificationToken` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_InterviewSessionToUser" DROP CONSTRAINT "_InterviewSessionToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_InterviewSessionToUser" DROP CONSTRAINT "_InterviewSessionToUser_B_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "ExecutionLog";

-- DropTable
DROP TABLE "InterviewSession";

-- DropTable
DROP TABLE "InterviewState";

-- DropTable
DROP TABLE "_InterviewSessionToUser";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interviewerId" TEXT,
    "intervieweeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
