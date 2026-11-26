import { z } from "zod";

export const checkoutSchema = z
  .object({
    plan: z.enum(["elite_collector"]).default("elite_collector"),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional()
  })
  .strict()
  .default({});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const portalSchema = z
  .object({
    returnUrl: z.string().url().optional()
  })
  .strict()
  .default({});

export type PortalInput = z.infer<typeof portalSchema>;

const normalizePlanName = (value: unknown): "standard" | "elite_collector" | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["standard", "free", "basic", "starter"].includes(normalized)) {
    return "standard";
  }
  if (
    ["elite_collector", "elite", "collector", "paid", "pro", "premium", "plus"].includes(normalized)
  ) {
    return "elite_collector";
  }
  return undefined;
};

export const changePlanSchema = z.preprocess(
  (value) => {
    const body =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const rawPlan = body.plan ?? body.planId ?? body.plan_id ?? body.tier ?? body.newPlan;
    const plan = normalizePlanName(rawPlan);
    const provider =
      typeof body.provider === "string" && body.provider.trim()
        ? body.provider.trim().toLowerCase()
        : undefined;
    const revenuecatAppUserId =
      typeof (body.revenuecatAppUserId ?? body.appUserId ?? body.app_user_id) === "string"
        ? String(body.revenuecatAppUserId ?? body.appUserId ?? body.app_user_id).trim() || undefined
        : undefined;
    const revenuecatProductId =
      typeof (body.revenuecatProductId ?? body.productId ?? body.product_id) === "string"
        ? String(body.revenuecatProductId ?? body.productId ?? body.product_id).trim() || undefined
        : undefined;
    const currentPeriodEnd =
      typeof (body.currentPeriodEnd ?? body.expiresAt ?? body.expires_at) === "string"
        ? String(body.currentPeriodEnd ?? body.expiresAt ?? body.expires_at).trim() || undefined
        : undefined;
    const cancelAtPeriodEnd =
      typeof body.cancelAtPeriodEnd === "boolean" ? body.cancelAtPeriodEnd : undefined;

    return {
      ...(plan !== undefined ? { plan } : {}),
      ...(provider !== undefined ? { provider } : {}),
      ...(revenuecatAppUserId !== undefined ? { revenuecatAppUserId } : {}),
      ...(revenuecatProductId !== undefined ? { revenuecatProductId } : {}),
      ...(currentPeriodEnd !== undefined ? { currentPeriodEnd } : {}),
      ...(cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd } : {})
    };
  },
  z.object({
    plan: z.enum(["standard", "elite_collector"]),
    provider: z.string().trim().min(1).max(40).optional(),
    revenuecatAppUserId: z.string().trim().min(1).max(200).optional(),
    revenuecatProductId: z.string().trim().min(1).max(200).optional(),
    currentPeriodEnd: z.string().trim().min(1).max(80).optional(),
    cancelAtPeriodEnd: z.boolean().optional()
  })
);

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
