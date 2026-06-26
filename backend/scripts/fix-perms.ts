import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const adminRole = await prisma.role.findFirst({ where: { key: 'company' } });
  if (!adminRole) return console.error("Admin role not found!");

  const perms = [
    'log.create', 'log.submit', 'mould.lifecycle.transition',
    'material.create', 'material.delete', 'vendor.create', 'assignment.revoke'
  ];
  
  for (const key of perms) {
    let p = await prisma.permission.findUnique({ where: { key } });
    if (!p) p = await prisma.permission.create({ data: { key } });
    
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      create: { roleId: adminRole.id, permissionId: p.id },
      update: {}
    });
  }
  
  // Also vendor needs log.create, log.submit
  const vendorRole = await prisma.role.findFirst({ where: { key: 'vendor' } });
  if (vendorRole) {
    for (const key of ['log.create', 'log.submit']) {
      let p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: vendorRole.id, permissionId: p.id } },
          create: { roleId: vendorRole.id, permissionId: p.id },
          update: {}
        });
      }
    }
  }

  console.log('Fixed permissions successfully!');
}
main().finally(() => prisma.$disconnect());
