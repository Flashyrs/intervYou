-- CreateTable
CREATE TABLE "InterviewState" (
    "sessionId" TEXT NOT NULL,
    "language" TEXT,
    "code" TEXT,
    "problemText" TEXT,
    "sampleTests" TEXT,
    "driver" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewState_pkey" PRIMARY KEY ("sessionId")
);
