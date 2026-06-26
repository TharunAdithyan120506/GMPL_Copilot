import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const companies = await prisma.company.findMany();
  console.log('Companies:', companies.length);
  const users = await prisma.user.findMany();
  console.log('Users:', users.map(u => ({ id: u.id, login: u.loginIdentifier, company: u.companyId })));
  const moulds = await prisma.mould.count();
  console.log('Moulds:', moulds);
  const rawMaterials = await prisma.rawMaterial.count();
  console.log('Raw Materials:', rawMaterials);
}
main().finally(() => prisma.$disconnect());
