import { AppError, ConflictError, ExternalServiceError } from "../../../common/errors/app-error.js";
import { getMarketplaceConfig } from "../../../config/marketplace.config.js";

export type MarketplaceListing = {
  externalId: string;
  title: string;
  brand?: string;
  model?: string;
  referenceNumber?: string;
  price: number;
  currency: string;
  sourceUrl: string;
  imageUrl?: string;
  condition?: string;
  productionYear?: number;
  movement?: string;
  scope?: string;
  aspects?: Record<string, string>;
  sellerUsername?: string;
  sellerFeedbackScore?: number;
  sellerFeedbackPercentage?: string;
  sellerAccountType?: string;
  location?: string;
  buyingOptions: string[];
};

export type MarketplaceSearchResult = {
  total: number | null;
  items: MarketplaceListing[];
};

export type MarketplaceListingDetails = MarketplaceListing & {
  description?: string;
  itemCreationDate?: string;
  itemEndDate?: string;
};

export type EbayInventoryItemInput = {
  sku: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  quantity: number;
  condition: string;
  categoryId: string;
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  marketplaceId?: string;
  format?: "FIXED_PRICE" | "AUCTION";
  imageUrls?: string[];
  aspects?: Record<string, string[]>;
  listingDuration?: string;
};

export type EbayPublishInventoryListingOptions = {
  sellerAccessToken: string;
  publish?: boolean;
};

export type EbayPublishInventoryListingResult = {
  sku: string;
  marketplaceId: string;
  offerId: string;
  listingId: string | null;
  listingUrl: string | null;
  published: boolean;
};

export type EbayOAuthTokenSet = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
};

export type EbayRefreshedAccessToken = {
  accessToken: string;
  accessTokenExpiresAt: Date;
};

export type EbaySellerUser = {
  ebayUserId: string;
  username: string | null;
};

export type EbaySellerSetup = {
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
};

export type EbayOfferSummary = {
  offerId: string;
  listingId: string | null;
  status: string | null;
};

export type EbayCategoryResolution = {
  categoryId: string;
  categoryName: string | null;
  categoryTreeId: string | null;
};

export type EbayAspectMetadata = {
  localizedAspectName: string;
  required: boolean;
  values: string[];
};

export interface MarketplaceProvider {
  code: "EBAY" | "CHRONO24" | "GRAILZEE";
  searchListings(query: string, options?: MarketplaceSearchOptions): Promise<MarketplaceListing[]>;
  checkConnectivity(): Promise<boolean>;
}

export type MarketplaceSearchOptions = {
  limit?: number;
  marketplaceId?: string;
  minPrice?: number;
  maxPrice?: number;
  priceCurrency?: string;
  deliveryPostalCode?: string;
  deliveryCountry?: string;
  pickupPostalCode?: string;
  pickupCountry?: string;
  pickupRadius?: number;
  pickupRadiusUnit?: "mi" | "km";
  sellerUsername?: string;
  timeoutMs?: number;
};

type EbayTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

type EbaySearchResponse = {
  total?: number;
  itemSummaries?: EbayItemSummary[];
};

type EbayItemResponse = EbayItemSummary & {
  description?: string;
  itemCreationDate?: string;
  itemEndDate?: string;
};

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  price?: {
    value?: string;
    currency?: string;
  };
  itemWebUrl?: string;
  image?: {
    imageUrl?: string;
  };
  condition?: string;
  localizedAspects?: Array<{
    name?: string;
    value?: string;
  }>;
  itemSpecifics?: Array<{
    name?: string;
    value?: string;
  }>;
  seller?: {
    username?: string;
    feedbackScore?: number;
    feedbackPercentage?: string;
    sellerAccountType?: string;
  };
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  buyingOptions?: string[];
};

type EbayCreateOfferResponse = {
  offerId?: string;
};

type EbayPublishOfferResponse = {
  listingId?: string;
};

type EbayIdentityResponse = {
  userId?: string;
  username?: string;
};

type EbayPolicy = {
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  name?: string;
};

type EbayOfferResponse = {
  offers?: Array<{
    offerId?: string;
    listing?: {
      listingId?: string;
    };
    status?: string;
  }>;
};

type EbayCategorySuggestionsResponse = {
  categorySuggestions?: Array<{
    category?: {
      categoryId?: string;
      categoryName?: string;
    };
    categoryTreeNodeAncestors?: Array<{
      categoryTreeId?: string;
    }>;
  }>;
};

type EbayAspectsResponse = {
  aspects?: Array<{
    localizedAspectName?: string;
    aspectConstraint?: {
      aspectRequired?: boolean;
    };
    aspectValues?: Array<{
      localizedValue?: string;
    }>;
  }>;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

const endpointBaseByEnvironment = {
  sandbox: "https://api.sandbox.ebay.com",
  production: "https://api.ebay.com"
} as const;

const identityEndpointBaseByEnvironment = {
  sandbox: "https://apiz.sandbox.ebay.com",
  production: "https://apiz.ebay.com"
} as const;

const authorizationBaseByEnvironment = {
  sandbox: "https://auth.sandbox.ebay.com",
  production: "https://auth.ebay.com"
} as const;

const defaultScope = "https://api.ebay.com/oauth/api_scope";
const sellerScopes = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly"
];
const ebayTokenTimeoutMs = 2_500;
const policyName = "Watchbox Default Policy";

const fetchWithTimeout = async (url: URL | string, init: RequestInit, timeoutMs: number, message: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ExternalServiceError(message);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const parseLimit = (limit: number | undefined): number => {
  if (typeof limit === "undefined") {
    return 20;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new ConflictError("eBay search limit must be between 1 and 200.");
  }
  return limit;
};

const endpointBase = (): string => {
  const config = getMarketplaceConfig().ebay;
  return config.apiBaseUrl ?? endpointBaseByEnvironment[config.environment];
};

const identityEndpointBase = (): string => {
  const config = getMarketplaceConfig().ebay;
  return identityEndpointBaseByEnvironment[config.environment];
};

const oauthCredentials = (): string => {
  const config = getMarketplaceConfig().ebay;
  if (!config.clientId || !config.clientSecret) {
    throw new ConflictError("eBay client ID and client secret are required.");
  }
  return Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
};

const tokenExpiry = (now: number, expiresInSeconds: number | undefined): Date =>
  new Date(now + Math.max((expiresInSeconds ?? 7200) - 60, 60) * 1000);

const compactLocation = (location: EbayItemSummary["itemLocation"]): string | undefined => {
  if (!location) {
    return undefined;
  }
  return [location.city, location.stateOrProvince, location.postalCode, location.country].filter(Boolean).join(", ") || undefined;
};

const normalizeAspectName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ebayAspects = (item: EbayItemSummary): Record<string, string> => {
  const entries = [...(item.localizedAspects ?? []), ...(item.itemSpecifics ?? [])];
  return Object.fromEntries(
    entries.flatMap((aspect) => {
      if (!aspect.name?.trim() || !aspect.value?.trim()) {
        return [];
      }
      return [[normalizeAspectName(aspect.name), aspect.value.trim()]];
    })
  );
};

const firstAspect = (aspects: Record<string, string>, names: string[]): string | undefined => {
  for (const name of names) {
    const value = aspects[normalizeAspectName(name)];
    if (value) {
      return value;
    }
  }
  return undefined;
};

const productionYearFromAspects = (aspects: Record<string, string>): number | undefined => {
  const value = firstAspect(aspects, ["Year Manufactured", "Production Year", "Year", "Manufacture Year"]);
  const match = value?.match(/\b(19|20)\d{2}\b/);
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const scopeFromAspects = (aspects: Record<string, string>): string | undefined => {
  const box = firstAspect(aspects, ["With Original Box/Packaging", "With Original Box", "Box"]);
  const papers = firstAspect(aspects, ["With Papers", "Papers"]);
  const hasBox = box ? /yes|with|included/i.test(box) : false;
  const hasPapers = papers ? /yes|with|included/i.test(papers) : false;
  if (hasBox && hasPapers) {
    return "full set";
  }
  if (hasBox) {
    return "box only";
  }
  if (hasPapers) {
    return "papers only";
  }
  return firstAspect(aspects, ["Scope", "Included", "Set Includes"]);
};

const requireSuccessfulEbayResponse = async (response: Response, action: string): Promise<void> => {
  if (response.ok) {
    return;
  }
  let message = "";
  let details: unknown[] = [];
  try {
    const payload = (await response.json()) as {
      errors?: Array<{ errorId?: number; domain?: string; category?: string; message?: string; longMessage?: string }>;
      error?: string;
      error_description?: string;
    };
    if (payload.errors?.length) {
      details = payload.errors;
      message = payload.errors
        .map((error) => error.longMessage ?? error.message)
        .filter((value): value is string => Boolean(value))
        .join(" ");
    } else if (payload.error || payload.error_description) {
      details = [
        {
          error: payload.error,
          error_description: payload.error_description
        }
      ];
      message = [payload.error, payload.error_description].filter(Boolean).join(": ");
    }
  } catch {
    message = "";
  }
  throw new AppError(
    "EBAY_API_ERROR",
    message ? `${action} failed with status ${response.status}: ${message}` : `${action} failed with status ${response.status}.`,
    response.status === 401 || response.status === 403 ? 409 : 502,
    details
  );
};

const offerIdFromLocation = (location: string | null): string | undefined => {
  if (!location) {
    return undefined;
  }
  return location.split("/").filter(Boolean).at(-1);
};

const ebayListingUrl = (listingId: string | null): string | null =>
  listingId ? `https://www.ebay.com/itm/${encodeURIComponent(listingId)}` : null;

export class EbayProvider implements MarketplaceProvider {
  public readonly code = "EBAY" as const;
  private cachedToken?: CachedToken;
  private tokenRequest: Promise<string> | undefined;

  public oauthConsentUrl(state: string): string {
    const config = getMarketplaceConfig().ebay;
    if (!config.clientId || !config.ruName) {
      throw new ConflictError("eBay client ID and RuName are required.");
    }
    const url = new URL(`${authorizationBaseByEnvironment[config.environment]}/oauth2/authorize`);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.ruName);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", sellerScopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  public async exchangeAuthorizationCode(code: string): Promise<EbayOAuthTokenSet> {
    const config = getMarketplaceConfig().ebay;
    if (!config.ruName) {
      throw new ConflictError("eBay RuName is required.");
    }
    const now = Date.now();
    const response = await fetchWithTimeout(
      `${endpointBase()}/identity/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${oauthCredentials()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: config.ruName
        })
      },
      ebayTokenTimeoutMs,
      "eBay authorization code exchange timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay authorization code exchange");
    const token = (await response.json()) as EbayTokenResponse;
    if (!token.access_token || !token.refresh_token) {
      throw new ExternalServiceError("eBay authorization response did not include access and refresh tokens.");
    }
    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      accessTokenExpiresAt: tokenExpiry(now, token.expires_in),
      refreshTokenExpiresAt: token.refresh_token_expires_in
        ? new Date(now + token.refresh_token_expires_in * 1000)
        : null
    };
  }

  public async refreshUserAccessToken(refreshToken: string): Promise<EbayRefreshedAccessToken> {
    const now = Date.now();
    const response = await fetchWithTimeout(
      `${endpointBase()}/identity/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${oauthCredentials()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: sellerScopes.join(" ")
        })
      },
      ebayTokenTimeoutMs,
      "eBay token refresh timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay token refresh");
    const token = (await response.json()) as EbayTokenResponse;
    if (!token.access_token) {
      throw new ExternalServiceError("eBay refresh response did not include an access token.");
    }
    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: tokenExpiry(now, token.expires_in)
    };
  }

  public async revokeUserRefreshToken(refreshToken: string): Promise<void> {
    const trimmedRefreshToken = refreshToken.trim();
    if (!trimmedRefreshToken) {
      throw new ConflictError("An eBay refresh token is required.");
    }
    const response = await fetchWithTimeout(
      `${endpointBase()}/identity/v1/oauth2/token/revoke`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${oauthCredentials()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token: trimmedRefreshToken,
          token_type_hint: "refresh_token"
        })
      },
      ebayTokenTimeoutMs,
      "eBay token revocation timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay token revocation");
  }

  public async getSellerUser(accessToken: string): Promise<EbaySellerUser> {
    const response = await fetchWithTimeout(
      `${identityEndpointBase()}/commerce/identity/v1/user`,
      {
        headers: this.userHeaders(accessToken)
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay identity request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay identity request");
    const payload = (await response.json()) as EbayIdentityResponse;
    const ebayUserId = payload.userId ?? payload.username;
    if (!ebayUserId) {
      throw new ExternalServiceError("eBay identity response did not include a user ID.");
    }
    return {
      ebayUserId,
      username: payload.username ?? null
    };
  }

  public async getOrCreateSellerSetup(accessToken: string, dealerId: string): Promise<EbaySellerSetup> {
    const marketplaceId = getMarketplaceConfig().ebay.marketplaceId;
    const [fulfillmentPolicyId, paymentPolicyId, returnPolicyId] = await Promise.all([
      this.getOrCreateFulfillmentPolicy(accessToken, marketplaceId),
      this.getOrCreatePaymentPolicy(accessToken, marketplaceId),
      this.getOrCreateReturnPolicy(accessToken, marketplaceId)
    ]);
    const merchantLocationKey = await this.getOrCreateInventoryLocation(accessToken, dealerId);
    return {
      merchantLocationKey,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId
    };
  }

  public async searchListings(
    query: string,
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceListing[]> {
    return (await this.searchListingsWithMetadata(query, options)).items;
  }

  public async searchListingsWithMetadata(
    query: string,
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceSearchResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new ConflictError("Search query is required.");
    }

    const config = getMarketplaceConfig().ebay;
    const baseUrl = endpointBase();
    const url = new URL(`${baseUrl}/buy/browse/v1/item_summary/search`);
    url.searchParams.set("q", trimmedQuery);
    url.searchParams.set("limit", parseLimit(options.limit).toString());
    const filters: string[] = [];
    if (typeof options.minPrice === "number" || typeof options.maxPrice === "number") {
      filters.push(`price:[${options.minPrice ?? ""}..${options.maxPrice ?? ""}]`);
      filters.push(`priceCurrency:${options.priceCurrency ?? "USD"}`);
    }
    if (options.deliveryPostalCode && options.deliveryCountry) {
      filters.push(`deliveryPostalCode:${options.deliveryPostalCode}`);
      filters.push(`deliveryCountry:${options.deliveryCountry}`);
    }
    if (options.pickupPostalCode && options.pickupCountry && options.pickupRadius && options.pickupRadiusUnit) {
      filters.push("deliveryOptions:{SELLER_ARRANGED_LOCAL_PICKUP}");
      filters.push(`pickupCountry:${options.pickupCountry}`);
      filters.push(`pickupPostalCode:${options.pickupPostalCode}`);
      filters.push(`pickupRadius:${options.pickupRadius}`);
      filters.push(`pickupRadiusUnit:${options.pickupRadiusUnit}`);
    }
    if (options.sellerUsername) {
      filters.push(`sellers:{${options.sellerUsername}}`);
    }
    if (filters.length > 0) {
      url.searchParams.set("filter", filters.join(","));
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.getApplicationAccessToken()}`,
      "X-EBAY-C-MARKETPLACE-ID": options.marketplaceId ?? config.marketplaceId
    };
    const contextualCountry = options.deliveryCountry ?? options.pickupCountry;
    const contextualPostalCode = options.deliveryPostalCode ?? options.pickupPostalCode;
    if (contextualCountry && contextualPostalCode) {
      headers["X-EBAY-C-ENDUSERCTX"] =
        `contextualLocation=country=${contextualCountry},zip=${encodeURIComponent(contextualPostalCode)}`;
    }

    const response = await fetchWithTimeout(
      url,
      { headers },
      options.timeoutMs ?? config.searchTimeoutMs,
      "eBay search timed out."
    );

    if (!response.ok) {
      throw new ExternalServiceError(`eBay search failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as EbaySearchResponse;
    const total = payload.total;
    return {
      total: typeof total === "number" && Number.isInteger(total) ? total : null,
      items: (payload.itemSummaries ?? []).flatMap(toMarketplaceListing)
    };
  }

  public async getListingDetails(
    itemId: string,
    options: Pick<MarketplaceSearchOptions, "marketplaceId"> = {}
  ): Promise<MarketplaceListingDetails> {
    const trimmedItemId = itemId.trim();
    if (!trimmedItemId) {
      throw new ConflictError("eBay item ID is required.");
    }

    const config = getMarketplaceConfig().ebay;
    const baseUrl = endpointBase();
    const response = await fetchWithTimeout(
      `${baseUrl}/buy/browse/v1/item/${encodeURIComponent(trimmedItemId)}`,
      {
        headers: {
          Authorization: `Bearer ${await this.getApplicationAccessToken()}`,
          "X-EBAY-C-MARKETPLACE-ID": options.marketplaceId ?? config.marketplaceId
        }
      },
      config.searchTimeoutMs,
      "eBay item detail request timed out."
    );

    if (!response.ok) {
      throw new ExternalServiceError(`eBay item detail request failed with status ${response.status}.`);
    }

    const item = (await response.json()) as EbayItemResponse;
    const listing = toMarketplaceListing(item)[0];
    if (!listing) {
      throw new ExternalServiceError("eBay item detail response did not include item data.");
    }
    const details: MarketplaceListingDetails = { ...listing };
    if (item.description) {
      details.description = item.description;
    }
    if (item.itemCreationDate) {
      details.itemCreationDate = item.itemCreationDate;
    }
    if (item.itemEndDate) {
      details.itemEndDate = item.itemEndDate;
    }
    return details;
  }

  public async publishInventoryListing(
    item: EbayInventoryItemInput,
    options: EbayPublishInventoryListingOptions
  ): Promise<EbayPublishInventoryListingResult> {
    const sellerAccessToken = options.sellerAccessToken.trim();
    if (!sellerAccessToken) {
      throw new ConflictError("An eBay seller access token is required.");
    }

    const config = getMarketplaceConfig().ebay;
    const baseUrl = endpointBase();
    const marketplaceId = item.marketplaceId ?? config.marketplaceId;
    const headers = {
      Authorization: `Bearer ${sellerAccessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US"
    };

    const inventoryResponse = await fetchWithTimeout(
      `${baseUrl}/sell/inventory/v1/inventory_item/${encodeURIComponent(item.sku)}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity: item.quantity
            }
          },
          condition: item.condition,
          product: {
            title: item.title,
            description: item.description,
            imageUrls: item.imageUrls ?? [],
            aspects: item.aspects ?? {}
          }
        })
      },
      config.searchTimeoutMs,
      "eBay inventory item request timed out."
    );
    await requireSuccessfulEbayResponse(inventoryResponse, "eBay inventory item request");

    const offerResponse = await fetchWithTimeout(
      `${baseUrl}/sell/inventory/v1/offer`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sku: item.sku,
          marketplaceId,
          format: item.format ?? "FIXED_PRICE",
          availableQuantity: item.quantity,
          categoryId: item.categoryId,
          merchantLocationKey: item.merchantLocationKey,
          listingDescription: item.description,
          listingPolicies: {
            fulfillmentPolicyId: item.fulfillmentPolicyId,
            paymentPolicyId: item.paymentPolicyId,
            returnPolicyId: item.returnPolicyId
          },
          pricingSummary: {
            price: {
              value: item.price.toFixed(2),
              currency: item.currency
            }
          },
          ...(item.listingDuration ? { listingDuration: item.listingDuration } : {})
        })
      },
      config.searchTimeoutMs,
      "eBay offer request timed out."
    );
    await requireSuccessfulEbayResponse(offerResponse, "eBay offer request");

    const offerPayload = (await offerResponse.json().catch(() => ({}))) as EbayCreateOfferResponse;
    const offerId = offerPayload.offerId ?? offerIdFromLocation(offerResponse.headers.get("location"));
    if (!offerId) {
      throw new ExternalServiceError("eBay offer response did not include an offer ID.");
    }

    if (options.publish === false) {
      return {
        sku: item.sku,
        marketplaceId,
        offerId,
        listingId: null,
        listingUrl: null,
        published: false
      };
    }

    const publishResponse = await fetchWithTimeout(
      `${baseUrl}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      {
        method: "POST",
        headers
      },
      config.searchTimeoutMs,
      "eBay publish offer request timed out."
    );
    await requireSuccessfulEbayResponse(publishResponse, "eBay publish offer request");

    const publishPayload = (await publishResponse.json().catch(() => ({}))) as EbayPublishOfferResponse;
    const listingId = publishPayload.listingId ?? null;

    return {
      sku: item.sku,
      marketplaceId,
      offerId,
      listingId,
      listingUrl: ebayListingUrl(listingId),
      published: true
    };
  }

  public async getOffersBySku(
    accessToken: string,
    sku: string,
    marketplaceId = getMarketplaceConfig().ebay.marketplaceId
  ): Promise<EbayOfferSummary[]> {
    const url = new URL(`${endpointBase()}/sell/inventory/v1/offer`);
    url.searchParams.set("sku", sku);
    url.searchParams.set("marketplace_id", marketplaceId);
    const response = await fetchWithTimeout(
      url,
      {
        headers: this.userHeaders(accessToken)
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay get offers request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay get offers request");
    const payload = (await response.json()) as EbayOfferResponse;
    return (payload.offers ?? []).flatMap((offer) =>
      offer.offerId
        ? [
            {
              offerId: offer.offerId,
              listingId: offer.listing?.listingId ?? null,
              status: offer.status ?? null
            }
          ]
        : []
    );
  }

  public async createOffer(
    accessToken: string,
    item: EbayInventoryItemInput
  ): Promise<string> {
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/offer`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify(this.offerPayload(item))
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay offer request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay offer request");
    const payload = (await response.json().catch(() => ({}))) as EbayCreateOfferResponse;
    const offerId = payload.offerId ?? offerIdFromLocation(response.headers.get("location"));
    if (!offerId) {
      throw new ExternalServiceError("eBay offer response did not include an offer ID.");
    }
    return offerId;
  }

  public async updateOffer(
    accessToken: string,
    offerId: string,
    item: EbayInventoryItemInput
  ): Promise<void> {
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
      {
        method: "PUT",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify(this.offerPayload(item))
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay update offer request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay update offer request");
  }

  public async createOrReplaceInventoryItem(
    accessToken: string,
    item: EbayInventoryItemInput
  ): Promise<void> {
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/inventory_item/${encodeURIComponent(item.sku)}`,
      {
        method: "PUT",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity: item.quantity
            }
          },
          condition: item.condition,
          product: {
            title: item.title,
            description: item.description,
            imageUrls: item.imageUrls ?? [],
            aspects: item.aspects ?? {}
          }
        })
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay inventory item request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay inventory item request");
  }

  public async publishOffer(accessToken: string, offerId: string): Promise<{ listingId: string | null; listingUrl: string | null }> {
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken)
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay publish offer request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay publish offer request");
    const payload = (await response.json().catch(() => ({}))) as EbayPublishOfferResponse;
    const listingId = payload.listingId ?? null;
    return {
      listingId,
      listingUrl: ebayListingUrl(listingId)
    };
  }

  public async resolveCategory(query: string, marketplaceId = getMarketplaceConfig().ebay.marketplaceId): Promise<EbayCategoryResolution> {
    const treeId = await this.defaultCategoryTreeId(marketplaceId);
    const url = new URL(`${endpointBase()}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions`);
    url.searchParams.set("q", query);
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${await this.getApplicationAccessToken()}`
        }
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay category suggestion request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay category suggestion request");
    const payload = (await response.json()) as EbayCategorySuggestionsResponse;
    const category = payload.categorySuggestions?.[0]?.category;
    if (!category?.categoryId) {
      return {
        categoryId: "31387",
        categoryName: "Wristwatches",
        categoryTreeId: treeId
      };
    }
    return {
      categoryId: category.categoryId,
      categoryName: category.categoryName ?? null,
      categoryTreeId: treeId
    };
  }

  public async getItemAspectsForCategory(categoryTreeId: string, categoryId: string): Promise<EbayAspectMetadata[]> {
    const url = new URL(
      `${endpointBase()}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(categoryTreeId)}/get_item_aspects_for_category`
    );
    url.searchParams.set("category_id", categoryId);
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${await this.getApplicationAccessToken()}`
        }
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay category aspects request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay category aspects request");
    const payload = (await response.json()) as EbayAspectsResponse;
    return (payload.aspects ?? []).flatMap((aspect) => {
      if (!aspect.localizedAspectName) {
        return [];
      }
      return [
        {
          localizedAspectName: aspect.localizedAspectName,
          required: aspect.aspectConstraint?.aspectRequired === true,
          values: (aspect.aspectValues ?? [])
            .map((value) => value.localizedValue)
            .filter((value): value is string => Boolean(value))
        }
      ];
    });
  }

  public async checkConnectivity(): Promise<boolean> {
    await this.getApplicationAccessToken();
    return true;
  }

  private userHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-US"
    };
  }

  private offerPayload(item: EbayInventoryItemInput): Record<string, unknown> {
    const marketplaceId = item.marketplaceId ?? getMarketplaceConfig().ebay.marketplaceId;
    return {
      sku: item.sku,
      marketplaceId,
      format: item.format ?? "FIXED_PRICE",
      availableQuantity: item.quantity,
      categoryId: item.categoryId,
      merchantLocationKey: item.merchantLocationKey,
      listingDescription: item.description,
      listingPolicies: {
        fulfillmentPolicyId: item.fulfillmentPolicyId,
        paymentPolicyId: item.paymentPolicyId,
        returnPolicyId: item.returnPolicyId
      },
      pricingSummary: {
        price: {
          value: item.price.toFixed(2),
          currency: item.currency
        }
      },
      ...(item.listingDuration ? { listingDuration: item.listingDuration } : {})
    };
  }

  private async defaultCategoryTreeId(marketplaceId: string): Promise<string> {
    const url = new URL(`${endpointBase()}/commerce/taxonomy/v1/get_default_category_tree_id`);
    url.searchParams.set("marketplace_id", marketplaceId);
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${await this.getApplicationAccessToken()}`
        }
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay default category tree request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay default category tree request");
    const payload = (await response.json()) as { categoryTreeId?: string };
    return payload.categoryTreeId ?? "0";
  }

  private async getOrCreateFulfillmentPolicy(accessToken: string, marketplaceId: string): Promise<string> {
    const existing = await this.findPolicy(accessToken, "fulfillment", marketplaceId);
    if (existing?.fulfillmentPolicyId) {
      return existing.fulfillmentPolicyId;
    }
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/account/v1/fulfillment_policy`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify({
          name: policyName,
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          handlingTime: { value: 1, unit: "DAY" },
          localPickup: false,
          shippingOptions: [
            {
              optionType: "DOMESTIC",
              costType: "FLAT_RATE",
              shippingServices: [
                {
                  sortOrder: 1,
                  shippingCarrierCode: "USPS",
                  shippingServiceCode: "USPSPriority",
                  shippingCost: { value: "0.00", currency: "USD" }
                }
              ]
            }
          ]
        })
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay fulfillment policy request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay fulfillment policy request");
    const payload = (await response.json()) as EbayPolicy;
    if (!payload.fulfillmentPolicyId) {
      throw new ExternalServiceError("eBay fulfillment policy response did not include a policy ID.");
    }
    return payload.fulfillmentPolicyId;
  }

  private async getOrCreatePaymentPolicy(accessToken: string, marketplaceId: string): Promise<string> {
    const existing = await this.findPolicy(accessToken, "payment", marketplaceId);
    if (existing?.paymentPolicyId) {
      return existing.paymentPolicyId;
    }
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/account/v1/payment_policy`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify({
          name: policyName,
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          immediatePay: true
        })
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay payment policy request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay payment policy request");
    const payload = (await response.json()) as EbayPolicy;
    if (!payload.paymentPolicyId) {
      throw new ExternalServiceError("eBay payment policy response did not include a policy ID.");
    }
    return payload.paymentPolicyId;
  }

  private async getOrCreateReturnPolicy(accessToken: string, marketplaceId: string): Promise<string> {
    const existing = await this.findPolicy(accessToken, "return", marketplaceId);
    if (existing?.returnPolicyId) {
      return existing.returnPolicyId;
    }
    const response = await fetchWithTimeout(
      `${endpointBase()}/sell/account/v1/return_policy`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify({
          name: policyName,
          marketplaceId,
          categoryTypes: [{ name: "ALL_EXCLUDING_MOTORS_VEHICLES", default: true }],
          returnsAccepted: false
        })
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay return policy request timed out."
    );
    await requireSuccessfulEbayResponse(response, "eBay return policy request");
    const payload = (await response.json()) as EbayPolicy;
    if (!payload.returnPolicyId) {
      throw new ExternalServiceError("eBay return policy response did not include a policy ID.");
    }
    return payload.returnPolicyId;
  }

  private async findPolicy(
    accessToken: string,
    type: "fulfillment" | "payment" | "return",
    marketplaceId: string
  ): Promise<EbayPolicy | undefined> {
    const url = new URL(`${endpointBase()}/sell/account/v1/${type}_policy`);
    url.searchParams.set("marketplace_id", marketplaceId);
    const response = await fetchWithTimeout(
      url,
      {
        headers: this.userHeaders(accessToken)
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      `eBay ${type} policy lookup timed out.`
    );
    await requireSuccessfulEbayResponse(response, `eBay ${type} policy lookup`);
    const payload = (await response.json()) as {
      fulfillmentPolicies?: EbayPolicy[];
      paymentPolicies?: EbayPolicy[];
      returnPolicies?: EbayPolicy[];
    };
    const policies =
      type === "fulfillment"
        ? payload.fulfillmentPolicies
        : type === "payment"
          ? payload.paymentPolicies
          : payload.returnPolicies;
    return policies?.find((policy) => policy.name === policyName) ?? policies?.[0];
  }

  private async getOrCreateInventoryLocation(accessToken: string, dealerId: string): Promise<string> {
    const merchantLocationKey = `watchbox-${dealerId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
    const getResponse = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
      {
        headers: this.userHeaders(accessToken)
      },
      getMarketplaceConfig().ebay.searchTimeoutMs,
      "eBay inventory location lookup timed out."
    );
    if (getResponse.ok) {
      return merchantLocationKey;
    }
    if (getResponse.status !== 404) {
      await requireSuccessfulEbayResponse(getResponse, "eBay inventory location lookup");
    }

    const config = getMarketplaceConfig().ebay;
    const createResponse = await fetchWithTimeout(
      `${endpointBase()}/sell/inventory/v1/location/${encodeURIComponent(merchantLocationKey)}`,
      {
        method: "POST",
        headers: this.userHeaders(accessToken),
        body: JSON.stringify({
          name: "Watchbox Dealer Location",
          merchantLocationStatus: "ENABLED",
          locationTypes: ["WAREHOUSE"],
          location: {
            address: {
              city: config.defaultLocation.city,
              stateOrProvince: config.defaultLocation.stateOrProvince,
              postalCode: config.defaultLocation.postalCode,
              country: config.defaultLocation.country
            }
          }
        })
      },
      config.searchTimeoutMs,
      "eBay inventory location request timed out."
    );
    await requireSuccessfulEbayResponse(createResponse, "eBay inventory location request");
    return merchantLocationKey;
  }

  private async getApplicationAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.accessToken;
    }
    if (this.tokenRequest) {
      return this.tokenRequest;
    }

    this.tokenRequest = this.requestApplicationAccessToken(now).finally(() => {
      this.tokenRequest = undefined;
    });
    return this.tokenRequest;
  }

  private async requestApplicationAccessToken(now: number): Promise<string> {
    const config = getMarketplaceConfig().ebay;
    const response = await fetchWithTimeout(
      `${endpointBase()}/identity/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${oauthCredentials()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: defaultScope
        })
      },
      Math.min(config.searchTimeoutMs, ebayTokenTimeoutMs),
      "eBay token request timed out."
    );

    if (!response.ok) {
      throw new ExternalServiceError(`eBay token request failed with status ${response.status}.`);
    }

    const token = (await response.json()) as EbayTokenResponse;
    if (!token.access_token) {
      throw new ExternalServiceError("eBay token response did not include an access token.");
    }

    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: now + Math.max((token.expires_in ?? 7200) - 60, 60) * 1000
    };
    return token.access_token;
  }
}

const toMarketplaceListing = (item: EbayItemSummary): MarketplaceListing[] => {
  const price = Number(item.price?.value);
  if (!item.itemId || !item.title || !Number.isFinite(price)) {
    return [];
  }
  const aspects = ebayAspects(item);
  const listing: MarketplaceListing = {
    externalId: item.itemId,
    title: item.title,
    price,
    currency: item.price?.currency ?? "USD",
    sourceUrl: item.itemWebUrl ?? `https://www.ebay.com/itm/${encodeURIComponent(item.itemId)}`,
    buyingOptions: item.buyingOptions ?? []
  };
  if (Object.keys(aspects).length > 0) {
    listing.aspects = aspects;
  }
  const brand = firstAspect(aspects, ["Brand"]);
  if (brand) {
    listing.brand = brand;
  }
  const model = firstAspect(aspects, ["Model"]);
  if (model) {
    listing.model = model;
  }
  const referenceNumber = firstAspect(aspects, ["Reference Number", "Reference", "MPN"]);
  if (referenceNumber) {
    listing.referenceNumber = referenceNumber;
  }
  const productionYear = productionYearFromAspects(aspects);
  if (productionYear) {
    listing.productionYear = productionYear;
  }
  const movement = firstAspect(aspects, ["Movement"]);
  if (movement) {
    listing.movement = movement;
  }
  const scope = scopeFromAspects(aspects);
  if (scope) {
    listing.scope = scope;
  }
  if (item.image?.imageUrl) {
    listing.imageUrl = item.image.imageUrl;
  }
  if (item.condition) {
    listing.condition = item.condition;
  }
  if (item.seller?.username) {
    listing.sellerUsername = item.seller.username;
  }
  if (typeof item.seller?.feedbackScore === "number") {
    listing.sellerFeedbackScore = item.seller.feedbackScore;
  }
  if (item.seller?.feedbackPercentage) {
    listing.sellerFeedbackPercentage = item.seller.feedbackPercentage;
  }
  if (item.seller?.sellerAccountType) {
    listing.sellerAccountType = item.seller.sellerAccountType;
  }
  const location = compactLocation(item.itemLocation);
  if (location) {
    listing.location = location;
  }
  return [listing];
};
