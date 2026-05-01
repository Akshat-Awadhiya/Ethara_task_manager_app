export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function assertFound<T>(value: T | null | undefined, message = "Resource not found"): T {
  if (!value) {
    throw new AppError(404, message);
  }

  return value;
}
