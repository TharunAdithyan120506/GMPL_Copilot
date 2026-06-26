import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.findUnique({ where: { loginIdentifier: 'admin' } });
  const vendor = await prisma.user.findUnique({ where: { loginIdentifier: 'gmpl_vendor' } });
  
  if (vendor) {
    const assignments = await prisma.assignment.count({ where: { vendorId: vendor.vendorId! } });
    console.log('Vendor Assignments:', assignments);
  }
}
main().finally(() => prisma.$disconnect());
