import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.mould.count();
  console.log('Total moulds in DB:', count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
