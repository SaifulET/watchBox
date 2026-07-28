import { getEnv } from "./env.js";

export const getEmailConfig = () => {
  const env = getEnv();
  return {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    apiKey: env.EMAIL_API_KEY,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD
    },
    webAppUrl: env.WEB_APP_URL
  };
};
