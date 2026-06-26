import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const company = await prisma.company.findFirst({ where: { name: 'GMPL' } });
  if (!company) return;

  let adminRole = await prisma.role.findFirst({ where: { key: 'company' } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: { companyId: company.id, key: 'company', name: 'Company Admin' }
    });
  }

  const hash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { loginIdentifier: 'admin' },
    update: { passwordHash: hash },
    create: {
      companyId: company.id,
      roleId: adminRole.id,
      loginIdentifier: 'admin',
      passwordHash: hash,
      isActive: true
    }
  });
  console.log('Admin user created:', admin.loginIdentifier);
}
main();
