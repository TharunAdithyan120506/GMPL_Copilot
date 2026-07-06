import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.dailyProductionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(logs.map(l => ({ id: l.id, status: l.status, logDate: l.logDate })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
