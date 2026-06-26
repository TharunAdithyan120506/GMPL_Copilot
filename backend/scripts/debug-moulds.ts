import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const companies = await prisma.company.findMany();
  for (const c of companies) {
    const mc = await prisma.mould.count({ where: { companyId: c.id } });
    console.log('Company:', c.name, c.id, 'Moulds:', mc);
  }
}
main().finally(() => prisma.$disconnect());
