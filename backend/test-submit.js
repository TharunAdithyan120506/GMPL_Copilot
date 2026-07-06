const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logId = 'eceb71e4-f9de-4311-aaac-0a122f9be716';
  
  await prisma.$transaction(async (tx) => {
      const [log] = await tx.$queryRaw`SELECT * FROM daily_production_logs WHERE id = ${logId}::uuid FOR UPDATE`;
      if (!log) throw new Error('not found');
      
      const mould = await tx.mould.findFirst({ where: { id: log.mould_id } });
      const totalParts = Number(log.accepted_qty) + Number(log.rejected_qty);
      if (totalParts % Number(mould.cavityCount) !== 0) {
        console.log(`VALIDATION_ERROR: Total parts (${totalParts}) is not perfectly divisible by mould cavity count (${mould.cavityCount}).`);
      } else {
        console.log("It is perfectly divisible!");
      }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
