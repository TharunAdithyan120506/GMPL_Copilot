export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: { field: string; issue: string }[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') => new AppError('AUTH_REQUIRED', msg, 401),
  forbidden: (msg = 'Insufficient permissions') => new AppError('FORBIDDEN', msg, 403),
  notFound: (entity = 'Resource') => new AppError('NOT_FOUND', `${entity} not found`, 404),
  conflict: (msg: string) => new AppError('CONFLICT', msg, 409),
  validation: (details: { field: string; issue: string }[]) =>
    new AppError('VALIDATION_ERROR', 'Validation failed', 422, details),
  stateTransition: (msg: string) => new AppError('STATE_TRANSITION_INVALID', msg, 409),
  rateLimited: () => new AppError('RATE_LIMITED', 'Too many requests', 429),
  aiUnavailable: () => new AppError('UPSTREAM_AI_UNAVAILABLE', 'AI service is currently unavailable', 503),
  internal: (msg = 'Internal server error') => new AppError('INTERNAL', msg, 500),
};
