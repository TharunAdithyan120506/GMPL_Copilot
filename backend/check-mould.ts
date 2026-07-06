import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const log = await prisma.dailyProductionLog.findUnique({ where: { id: 'eceb71e4-f9de-4311-aaac-0a122f9be716' }, include: { mould: true } });
  console.log('Mould Cavity Count:', log?.mould.cavityCount);
  console.log('Accepted:', log?.acceptedQty, 'Rejected:', log?.rejectedQty);
}

main().catch(console.error).finally(() => prisma.$disconnect());
