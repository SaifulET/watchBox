import { getEnv } from "./env.js";

export const getMarketplaceConfig = () => {
  const env = getEnv();
  return {
    ebay: {
      clientId: env.EBAY_CLIENT_ID,
      clientSecret: env.EBAY_CLIENT_SECRET,
      redirectUri: env.EBAY_REDIRECT_URI,
      ruName: env.EBAY_RUNAME,
      apiBaseUrl: env.EBAY_API_BASE_URL,
      environment: env.EBAY_ENVIRONMENT,
      marketplaceId: env.EBAY_MARKETPLACE_ID,
      searchTimeoutMs: env.EBAY_SEARCH_TIMEOUT_MS,
      defaultLocation: {
        city: env.EBAY_DEFAULT_LOCATION_CITY,
        stateOrProvince: env.EBAY_DEFAULT_LOCATION_STATE,
        postalCode: env.EBAY_DEFAULT_LOCATION_POSTAL_CODE,
        country: env.EBAY_DEFAULT_LOCATION_COUNTRY
      }
    },
    chrono24: {
      scrapingbeeApiKey: env.SCRAPINGBEE_API_KEY,
      searchTimeoutMs: env.CHRONO24_SEARCH_TIMEOUT_MS,
      baseUrl: "https://www.chrono24.com"
    }
  };
};
