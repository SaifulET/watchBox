import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdHeader = "x-request-id";

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const headerValue = req.header(requestIdHeader);
  req.requestId = headerValue && headerValue.length <= 128 ? headerValue : randomUUID();
  res.setHeader(requestIdHeader, req.requestId);
  next();
};
