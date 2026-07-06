import { DailyLoggingService } from './src/modules/daily-logging/daily-logging.service';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logId = 'eceb71e4-f9de-4311-aaac-0a122f9be716';
  const log = await prisma.dailyProductionLog.findUnique({ where: { id: logId } });
  
  if (!log) throw new Error("not found");

  const auth: any = {
    userId: log.createdBy,
    companyId: log.companyId,
    role: 'vendor',
    vendorId: log.vendorId,
    permissions: [],
  };

  const res = await DailyLoggingService.submit(auth, logId, 'test-idempotency');
  console.log('Submit Success:', res);
}

main().catch(e => console.error('Submit Failed:', e)).finally(() => prisma.$disconnect());
