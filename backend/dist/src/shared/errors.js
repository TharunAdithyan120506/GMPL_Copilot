"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Errors = exports.AppError = void 0;
class AppError extends Error {
    code;
    status;
    details;
    constructor(code, message, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
exports.Errors = {
    unauthorized: () => new AppError('AUTH_REQUIRED', 'Authentication required', 401),
    forbidden: (msg = 'Insufficient permissions') => new AppError('FORBIDDEN', msg, 403),
    notFound: (entity = 'Resource') => new AppError('NOT_FOUND', `${entity} not found`, 404),
    conflict: (msg) => new AppError('CONFLICT', msg, 409),
    validation: (details) => new AppError('VALIDATION_ERROR', 'Validation failed', 422, details),
    stateTransition: (msg) => new AppError('STATE_TRANSITION_INVALID', msg, 409),
    rateLimited: () => new AppError('RATE_LIMITED', 'Too many requests', 429),
    aiUnavailable: () => new AppError('UPSTREAM_AI_UNAVAILABLE', 'AI service is currently unavailable', 503),
    internal: (msg = 'Internal server error') => new AppError('INTERNAL', msg, 500),
};
