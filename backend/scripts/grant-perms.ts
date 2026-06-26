import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const adminRole = await prisma.role.findFirst({ where: { key: 'company' } });
  const vendorRole = await prisma.role.findFirst({ where: { key: 'vendor' } });
  
  const companyPerms = [
    'mould.view',
    'mould.create',
    'mould.edit',
    'mould.lifecycle.transition',
    'log.view',
    'log.approve_edit',
    'vendor.view',
    'vendor.create',
    'vendor.edit',
    'material.view',
    'material.create',
    'material.edit',
    'material.delete',
    'assignment.view',
    'assignment.create',
    'assignment.revoke',
    'repair.view',
    'repair.create',
    'repair.update',
  ];
  const vendorPerms = [
    'mould.view',
    'log.view',
    'log.create',
    'log.edit',
    'log.submit',
    'assignment.view',
  ];
  const allPerms = Array.from(new Set([...companyPerms, ...vendorPerms]));
  
  for (const key of allPerms) {
    let p = await prisma.permission.findUnique({ where: { key } });
    if (!p) p = await prisma.permission.create({ data: { key } });
    
    if (adminRole && companyPerms.includes(key)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {}
      });
    }
    if (vendorRole && vendorPerms.includes(key)) {
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
