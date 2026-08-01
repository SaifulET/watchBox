import type { NextFunction, Request, Response } from "express";
import type { ZodError } from "zod";
import { buildMeta } from "../utils/api-response.js";
import { AppError, ValidationError } from "./app-error.js";

export const fromZodError = (error: ZodError): ValidationError =>
  new ValidationError(
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  );

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError("ROUTE_NOT_FOUND", `No route matches ${req.method} ${req.originalUrl}.`, 404));
};

type BodyParserSyntaxError = SyntaxError & {
  status?: number;
  statusCode?: number;
  type?: string;
  body?: string;
};

const isBodyParserSyntaxError = (error: Error): error is BodyParserSyntaxError =>
  error instanceof SyntaxError &&
  (error as BodyParserSyntaxError).type === "entity.parse.failed" &&
  ((error as BodyParserSyntaxError).status === 400 || (error as BodyParserSyntaxError).statusCode === 400);

const normalizeError = (error: Error): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isBodyParserSyntaxError(error)) {
    return new AppError("INVALID_JSON", "Request body contains invalid JSON.", 400, [
      {
        path: "body",
        message: error.message
      }
    ]);
  }
  return new AppError("INTERNAL_SERVER_ERROR", "An unexpected error occurred.", 500);
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const appError = normalizeError(error);

  if (appError.statusCode >= 500) {
    req.log?.error({ err: error, requestId: req.requestId }, "Unhandled API error");
  }

  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details
    },
    meta: buildMeta(req.requestId)
  });
};
