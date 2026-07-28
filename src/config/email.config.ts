import { getEnv } from "./env.js";

export const getEmailConfig = () => {
  const env = getEnv();
  return {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    apiKey: env.EMAIL_API_KEY
  };
};
