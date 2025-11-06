-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "problemId" TEXT,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InterviewParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_InterviewParticipants_AB_unique" ON "_InterviewParticipants"("A", "B");

-- CreateIndex
CREATE INDEX "_InterviewParticipants_B_index" ON "_InterviewParticipants"("B");

-- AddForeignKey
ALTER TABLE "_InterviewParticipants" ADD CONSTRAINT "_InterviewParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterviewParticipants" ADD CONSTRAINT "_InterviewParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
