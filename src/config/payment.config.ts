import { getEnv } from "./env.js";

export const getPaymentConfig = () => {
  const env = getEnv();
  return {
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripeElitePriceId: env.STRIPE_ELITE_PRICE_ID
  };
};
