"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiCopilotService = void 0;
const prisma_1 = require("../../shared/prisma");
const errors_1 = require("../../shared/errors");
exports.AiCopilotService = {
    async getConversations(ctx) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company admins can use Copilot');
        return prisma_1.prisma.aiConversation.findMany({
            where: { companyId: ctx.companyId, userId: ctx.userId },
            orderBy: { updatedAt: 'desc' }
        });
    },
    async startConversation(ctx) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company admins can use Copilot');
        return prisma_1.prisma.aiConversation.create({
            data: {
                companyId: ctx.companyId,
                userId: ctx.userId,
            }
        });
    },
    async getMessages(ctx, conversationId) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company admins can use Copilot');
        // Verify ownership
        const conv = await prisma_1.prisma.aiConversation.findFirst({
            where: { id: conversationId, companyId: ctx.companyId, userId: ctx.userId }
        });
        if (!conv)
            throw errors_1.Errors.notFound('Conversation not found');
        return prisma_1.prisma.aiMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' }
        });
    },
    async sendMessage(ctx, conversationId, content) {
        if (ctx.role !== 'company')
            throw errors_1.Errors.forbidden('Only company admins can use Copilot');
        const conv = await prisma_1.prisma.aiConversation.findFirst({
            where: { id: conversationId, companyId: ctx.companyId, userId: ctx.userId }
        });
        if (!conv)
            throw errors_1.Errors.notFound('Conversation not found');
        // 1. Save user message
        await prisma_1.prisma.aiMessage.create({
            data: {
                conversationId,
                companyId: ctx.companyId,
                role: 'user',
                content,
                status: 'completed'
            }
        });
        // 2. MOCK AI Response (Since no API keys are provided for LLM in MVP)
        // In production, this would call OpenAI/Gemini/Gemma with schema retrieval and SQL generation.
        const lowerContent = content.toLowerCase();
        let reply = "I analyzed the production logs across all vendors. Operations are normal.";
        if (lowerContent.includes('vendor') || lowerContent.includes('performance')) {
            reply = "Vendor Alpha currently has the highest output efficiency for PP-XPPA-0597, with a rejection rate of only 1.2% over the last 30 days. Vendor Delta requires attention due to higher downtime.";
        }
        else if (lowerContent.includes('mould') || lowerContent.includes('life')) {
            reply = "There are 5 moulds currently exceeding 90% of their shot life limit. I recommend scheduling them for predictive maintenance soon.";
        }
        else if (lowerContent.includes('stock') || lowerContent.includes('material')) {
            reply = "Polycarbonate (PC - Lexan 141R) is currently at 32% stock level and may require reordering within the week.";
        }
        // Simulate latency
        await new Promise(resolve => setTimeout(resolve, 1500));
        // 3. Save assistant message
        const assistantMsg = await prisma_1.prisma.aiMessage.create({
            data: {
                conversationId,
                companyId: ctx.companyId,
                role: 'assistant',
                content: reply,
                status: 'completed'
            }
        });
        // Update conversation timestamp
        await prisma_1.prisma.aiConversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });
        return assistantMsg;
    }
};
