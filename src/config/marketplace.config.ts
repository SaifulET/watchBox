import { getEnv } from "./env.js";

export const getMarketplaceConfig = () => {
  const env = getEnv();
  return {
    ebay: {
      clientId: env.EBAY_CLIENT_ID,
      clientSecret: env.EBAY_CLIENT_SECRET,
      redirectUri: env.EBAY_REDIRECT_URI,
      environment: env.EBAY_ENVIRONMENT,
      marketplaceId: env.EBAY_MARKETPLACE_ID,
      searchTimeoutMs: env.EBAY_SEARCH_TIMEOUT_MS
    }
  };
};
