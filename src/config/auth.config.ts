import { getEnv } from "./env.js";

export const getAuthConfig = () => {
  const env = getEnv();
  return {
    customerAccessSecret: env.JWT_CUSTOMER_ACCESS_SECRET,
    customerRefreshSecret: env.JWT_CUSTOMER_REFRESH_SECRET,
    adminAccessSecret: env.JWT_ADMIN_ACCESS_SECRET,
    adminRefreshSecret: env.JWT_ADMIN_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL
  };
};
