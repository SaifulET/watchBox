import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";

export const createSecurityMiddleware = (env: Env): RequestHandler[] => [
  helmet(),
  cors({ origin: true, credentials: true }),
  rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === "test" ? 10_000 : 600,
    standardHeaders: "draft-7",
    legacyHeaders: false
  }),
  mongoSanitize()
];
