"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = require("../../shared/prisma");
exports.NotificationService = {
    async enqueue(companyId, type, payload) {
        return prisma_1.prisma.notification.create({
            data: { companyId, type, payload, status: 'pending' },
        });
    },
    async dispatch() {
        const pending = await prisma_1.prisma.notification.findMany({
            where: { status: 'pending' },
            take: 20,
        });
        for (const n of pending) {
            try {
                // In V1: log to console + mark delivered
                // Future: send email/webhook here
                console.log(`[NOTIFY] type=${n.type}`, n.payload);
                await prisma_1.prisma.notification.update({
                    where: { id: n.id },
                    data: { status: 'delivered' },
                });
            }
            catch {
                await prisma_1.prisma.notification.update({
                    where: { id: n.id },
                    data: { status: 'failed' },
                });
            }
        }
    },
};
