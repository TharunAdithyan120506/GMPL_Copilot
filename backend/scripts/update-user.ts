import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('password', 10);
  await prisma.user.update({
    where: { loginIdentifier: 'gmpl_vendor' },
    data: { passwordHash: hash }
  });
  console.log('Updated user password');
}
main();
