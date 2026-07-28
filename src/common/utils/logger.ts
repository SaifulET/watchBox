import pino, { type LoggerOptions } from "pino";
import { getEnv } from "../../config/env.js";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.accessKey",
  "*.refreshToken",
  "*.privateKey"
];

export const createLogger = (bindings: Record<string, unknown> = {}) => {
  const env = getEnv();
  const options: LoggerOptions = {
    name: "WatchBox",
    level: env.NODE_ENV === "test" ? "silent" : "info",
    base: bindings,
    redact: {
      paths: redactedPaths,
      censor: "[REDACTED]"
    },
    timestamp: pino.stdTimeFunctions.isoTime
  };

  return pino(options);
};

export type WatchboxLogger = ReturnType<typeof createLogger>;
