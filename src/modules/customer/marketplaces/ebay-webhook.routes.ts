import { createHash } from "node:crypto";
import { Router } from "express";
import { getEnv } from "../../../config/env.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";

export const createEbayWebhookRouter = (): Router => {
  const router = Router();

  router.get(
    "/webhooks/ebay",
    asyncHandler(async (req, res) => {
      const challengeCode = typeof req.query.challenge_code === "string" ? req.query.challenge_code : "";
      const env = getEnv();
      const verificationToken = env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN;
      const notificationEndpoint = `${env.API_PUBLIC_URL.replace(/\/+$/, "")}${env.API_PREFIX}/webhooks/ebay`;

      if (!challengeCode || !verificationToken) {
        res.status(400).json({ error: "Missing eBay challenge code or verification token." });
        return;
      }

      const challengeResponse = createHash("sha256")
        .update(challengeCode)
        .update(verificationToken)
        .update(notificationEndpoint)
        .digest("hex");

      res.status(200).json({ challengeResponse });
    })
  );

  router.post(
    "/webhooks/ebay",
    asyncHandler(async (_req, res) => {
      res.status(204).send();
    })
  );

  return router;
};
