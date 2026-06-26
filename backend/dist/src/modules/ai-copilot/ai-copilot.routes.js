"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_copilot_service_1 = require("./ai-copilot.service");
const auth_middleware_1 = require("../../cross-cutting/auth/auth.middleware");
const response_1 = require("../../shared/response");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/conversations', async (req, res) => {
    try {
        const data = await ai_copilot_service_1.AiCopilotService.getConversations(req.auth);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/conversations', async (req, res) => {
    try {
        const data = await ai_copilot_service_1.AiCopilotService.startConversation(req.auth);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.get('/conversations/:id', async (req, res) => {
    try {
        const data = await ai_copilot_service_1.AiCopilotService.getMessages(req.auth, req.params.id);
        return (0, response_1.success)(res, data);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
router.post('/conversations/:id/messages', async (req, res) => {
    try {
        if (!req.body.content)
            throw { code: 'VALIDATION_ERROR', message: 'content is required', status: 400 };
        const data = await ai_copilot_service_1.AiCopilotService.sendMessage(req.auth, req.params.id, req.body.content);
        return (0, response_1.success)(res, data, 201);
    }
    catch (err) {
        return (0, response_1.error)(res, err.code || 'INTERNAL', err.message, err.status || 500);
    }
});
exports.default = router;
