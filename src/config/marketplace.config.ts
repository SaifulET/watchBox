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
      scrapingBeeApiKey: env.SCRAPINGBEE_API_KEY,
      baseUrl: env.CHRONO24_BASE_URL,
      countryCode: env.CHRONO24_COUNTRY_CODE,
      renderJs: env.CHRONO24_RENDER_JS,
      stealthProxy: env.CHRONO24_STEALTH_PROXY,
      blockResources: env.CHRONO24_BLOCK_RESOURCES
    }
  };
};
