-- CreateTable
CREATE TABLE "InterviewState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "language" TEXT,
    "code" TEXT,
    "problemText" TEXT,
    "sampleTests" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewState_sessionId_key" ON "InterviewState"("sessionId");
