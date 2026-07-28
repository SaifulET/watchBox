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

export class AuthenticationError extends AppError {
  public constructor(message = "Authentication is required.") {
    super("AUTHENTICATION_REQUIRED", message, 401);
  }
}

export class AuthorizationError extends AppError {
  public constructor(message = "You do not have permission to perform this action.") {
    super("AUTHORIZATION_FAILED", message, 403);
  }
}

export class ResourceNotFoundError extends AppError {
  public constructor(message = "Resource not found.") {
    super("RESOURCE_NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  public constructor(message = "The requested change conflicts with the current resource state.") {
    super("RESOURCE_CONFLICT", message, 409);
  }
}

export class RateLimitError extends AppError {
  public constructor(message = "Too many requests. Please try again later.") {
    super("RATE_LIMIT_EXCEEDED", message, 429);
  }
}

export class ExternalServiceError extends AppError {
  public constructor(message = "An external service is unavailable.") {
    super("EXTERNAL_SERVICE_ERROR", message, 502);
  }
}
