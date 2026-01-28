
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const sessionId = 'cmkpyaqzm0007v8ilcs5hrf5r';
    console.log(`Fetching state for session: ${sessionId}`);
    const state = await prisma.interviewState.findUnique({
        where: { sessionId }
    });
    console.log(JSON.stringify(state, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
