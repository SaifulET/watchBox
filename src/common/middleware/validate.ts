import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { fromZodError } from "../errors/error-handler.js";

type ValidationTargets = {
  body?: ZodType<unknown>;
  query?: ZodType<unknown>;
  params?: ZodType<unknown>;
};

export const validate = (targets: ValidationTargets): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const body = targets.body?.safeParse(req.body);
    if (body && !body.success) {
      next(fromZodError(body.error));
      return;
    }
    if (body) {
      const parsedBody: unknown = body.data;
      req.body = parsedBody;
    }

    const query = targets.query?.safeParse(req.query);
    if (query && !query.success) {
      next(fromZodError(query.error));
      return;
    }

    const params = targets.params?.safeParse(req.params);
    if (params && !params.success) {
      next(fromZodError(params.error));
      return;
    }

    next();
  };
};
