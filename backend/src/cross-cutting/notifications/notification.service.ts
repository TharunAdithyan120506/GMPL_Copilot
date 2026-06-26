import { prisma } from '../../shared/prisma';

export const NotificationService = {
  async enqueue(companyId: string, type: string, payload: object) {
    return prisma.notification.create({
      data: { companyId, type, payload, status: 'pending' },
    });
  },

  async dispatch() {
    const pending = await prisma.notification.findMany({
      where: { status: 'pending' },
      take: 20,
    });
    for (const n of pending) {
      try {
        // In V1: log to console + mark delivered
        // Future: send email/webhook here
        console.log(`[NOTIFY] type=${n.type}`, n.payload);
        await prisma.notification.update({
          where: { id: n.id },
          data: { status: 'delivered' },
        });
      } catch {
        await prisma.notification.update({
          where: { id: n.id },
          data: { status: 'failed' },
        });
      }
    }
  },
};
