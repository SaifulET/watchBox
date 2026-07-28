export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: unknown[];
  public readonly isOperational = true;

  public constructor(code: string, message: string, statusCode = 500, details: unknown[] = []) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  public constructor(details: unknown[]) {
    super("VALIDATION_ERROR", "Request validation failed.", 400, details);
  }
}
