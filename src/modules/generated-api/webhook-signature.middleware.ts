import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AuthenticationError } from "../../common/errors/app-error.js";
import { getEnv } from "../../config/env.js";

const signatureHeaders = [
  "stripe-signature",
  "x-ebay-signature",
  "x-email-signature",
  "x-push-signature",
  "x-watchbox-signature"
];

const readSignature = (headers: Record<string, string | string[] | undefined>): string | undefined => {
  for (const header of signatureHeaders) {
    const value = headers[header];
    if (typeof value === "string" && value.length > 0) {
      return value.replace(/^sha256=/, "");
    }
  }
  return undefined;
};

export const validateWebhookSignature = (): RequestHandler => {
  return (req, _res, next) => {
    const env = getEnv();
    const secret = req.path.includes("/stripe")
      ? env.STRIPE_WEBHOOK_SECRET
      : env.ENCRYPTION_KEY;

    if (!secret && env.NODE_ENV !== "production") {
      next();
      return;
    }

    const signature = readSignature(req.headers);
    if (!signature) {
      next(new AuthenticationError("Webhook signature is required."));
      return;
    }

    const expected = createHmac("sha256", secret ?? env.ENCRYPTION_KEY)
      .update(JSON.stringify(req.body ?? {}))
      .digest("hex");
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      next(new AuthenticationError("Webhook signature is invalid."));
      return;
    }

    next();
  };
};
