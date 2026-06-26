import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const adminRole = await prisma.role.findFirst({ where: { key: 'company' } });
  const vendorRole = await prisma.role.findFirst({ where: { key: 'vendor' } });
  
  const perms = ['mould.view', 'mould.edit', 'mould.create', 'log.view', 'log.edit', 'vendor.view', 'vendor.edit', 'material.view', 'material.edit', 'assignment.view', 'assignment.create', 'repair.view', 'repair.update'];
  
  for (const key of perms) {
    let p = await prisma.permission.findUnique({ where: { key } });
    if (!p) p = await prisma.permission.create({ data: { key } });
    
    // admin
    if (adminRole) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {}
      });
    }
    // vendor
    if (vendorRole) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: vendorRole.id, permissionId: p.id } },
        create: { roleId: vendorRole.id, permissionId: p.id },
        update: {}
      });
    }
  }
  console.log('Permissions granted successfully!');
}
main().finally(() => prisma.$disconnect());
