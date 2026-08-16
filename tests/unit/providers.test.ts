import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAiProvider, LocalAiProvider } from "../../src/infrastructure/external/ai/ai-provider.js";
import { EbayProvider } from "../../src/infrastructure/external/ebay/ebay-provider.js";
import { EbayConnectionModel } from "../../src/modules/customer/ebay/ebay-connection.model.js";
import { EbayService } from "../../src/modules/customer/ebay/ebay.service.js";
import { LocalEmailProvider } from "../../src/infrastructure/external/email/email-provider.js";
import { LocalPaymentProvider } from "../../src/infrastructure/external/stripe/stripe-provider.js";
import { MarketplaceService } from "../../src/modules/customer/marketplaces/marketplaces.service.js";
import { resetEnvForTests } from "../../src/config/env.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
  delete process.env.EBAY_API_BASE_URL;
  delete process.env.EBAY_RUNAME;
  delete process.env.EBAY_ENVIRONMENT;
  delete process.env.EBAY_MARKETPLACE_ID;
  delete process.env.AI_PROVIDER;
  delete process.env.AI_SERVICE_URL;
  delete process.env.AI_SERVICE_TOKEN;
  delete process.env.AI_MODEL;
  delete process.env.AI_EMBEDDING_MODEL;
  delete process.env.EMAIL_PROVIDER;
  resetEnvForTests();
});

const configureSandboxEbay = (): void => {
  process.env.EBAY_CLIENT_ID = "client-id";
  process.env.EBAY_CLIENT_SECRET = "client-secret";
  process.env.EBAY_API_BASE_URL = "https://api.sandbox.ebay.com";
  process.env.EBAY_RUNAME = "Watchbox-Watchbox-SBX-runame";
  process.env.EBAY_ENVIRONMENT = "sandbox";
  process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
  resetEnvForTests();
};

describe("local provider adapters", () => {
  it("analyzes watch images deterministically", async () => {
    const provider = new LocalAiProvider();
    const result = await provider.analyzeImage({ imageUrl: "https://example.test/watch.jpg" });

    expect(result.containsWatch).toBe(true);
    expect(result.embedding).toHaveLength(64);
  });

  it("creates local payment sessions", async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createCheckoutSession({
      customerId: "customer-1",
      priceId: "price-1",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel"
    });

    expect(result.url).toBe("https://example.test/success");
  });

  it("returns local email delivery identifiers", async () => {
    process.env.EMAIL_PROVIDER = "local";
    resetEnvForTests();

    const provider = new LocalEmailProvider();
    const result = await provider.send({
      to: "buyer@example.test",
      subject: "Welcome",
      html: "<p>Welcome</p>"
    });

    expect(result.providerMessageId).toContain("local-email");
  });

  it("searches eBay listings with an application token", async () => {
    configureSandboxEbay();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemSummaries: [
              {
                itemId: "v1|123|0",
                title: "Rolex Submariner",
                price: { value: "12500.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/123",
                image: { imageUrl: "https://i.ebayimg.test/123.jpg" },
                condition: "Pre-Owned",
                seller: {
                  username: "watch-seller",
                  feedbackScore: 1240,
                  feedbackPercentage: "99.8"
                },
                itemLocation: { city: "New York", stateOrProvince: "NY", country: "US" },
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        )
      );

    const provider = new EbayProvider();
    const results = await provider.searchListings("Rolex Submariner", { limit: 1 });

    expect(results).toEqual([
      {
        externalId: "v1|123|0",
        title: "Rolex Submariner",
        price: 12500,
        currency: "USD",
        sourceUrl: "https://www.ebay.com/itm/123",
        imageUrl: "https://i.ebayimg.test/123.jpg",
        condition: "Pre-Owned",
        sellerUsername: "watch-seller",
        sellerFeedbackScore: 1240,
        sellerFeedbackPercentage: "99.8",
        location: "New York, NY, US",
        buyingOptions: ["FIXED_PRICE"]
      }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
      expect.objectContaining({ method: "POST" })
    );
    const searchCall = fetchMock.mock.calls[1];
    expect(searchCall?.[0]).toBeInstanceOf(URL);
    expect((searchCall?.[0] as URL).href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=Rolex+Submariner&limit=1"
    );
    expect(searchCall?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer access-token",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
      }
    });
  });

  it("filters eBay marketplace search by seller username", async () => {
    configureSandboxEbay();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));

    const provider = new EbayProvider();
    await provider.searchListingsWithMetadata("watch", {
      limit: 20,
      sellerUsername: "watch-seller"
    });

    expect((fetchMock.mock.calls[1]?.[0] as URL).href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=watch&limit=20&filter=sellers%3A%7Bwatch-seller%7D"
    );
  });

  it("creates and publishes an eBay inventory listing with a seller token", async () => {
    configureSandboxEbay();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ offerId: "offer-123" }), {
          status: 201
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ listingId: "9876543210" }), {
          status: 200
        })
      );

    const provider = new EbayProvider();
    const result = await provider.publishInventoryListing(
      {
        sku: "watchbox-listing-1",
        title: "Rolex Submariner",
        description: "Pre-owned Rolex Submariner",
        price: 12500,
        currency: "USD",
        quantity: 1,
        condition: "USED_EXCELLENT",
        categoryId: "31387",
        merchantLocationKey: "warehouse-1",
        fulfillmentPolicyId: "fulfillment-policy",
        paymentPolicyId: "payment-policy",
        returnPolicyId: "return-policy",
        imageUrls: ["https://cdn.example.test/watch.jpg"],
        aspects: {
          Brand: ["Rolex"],
          Model: ["Submariner"]
        }
      },
      {
        sellerAccessToken: "seller-token"
      }
    );

    expect(result).toEqual({
      sku: "watchbox-listing-1",
      marketplaceId: "EBAY_US",
      offerId: "offer-123",
      listingId: "9876543210",
      listingUrl: "https://www.ebay.com/itm/9876543210",
      published: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item/watchbox-listing-1"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      headers: {
        Authorization: "Bearer seller-token",
        "Content-Type": "application/json",
        "Content-Language": "en-US"
      }
    });
    const rawOfferBody = fetchMock.mock.calls[1]?.[1]?.body;
    const offerBody = JSON.parse(typeof rawOfferBody === "string" ? rawOfferBody : "{}") as Record<string, unknown>;
    expect(offerBody).toMatchObject({
      sku: "watchbox-listing-1",
      marketplaceId: "EBAY_US",
      categoryId: "31387",
      pricingSummary: {
        price: {
          value: "12500.00",
          currency: "USD"
        }
      },
      listingPolicies: {
        fulfillmentPolicyId: "fulfillment-policy",
        paymentPolicyId: "payment-policy",
        returnPolicyId: "return-policy"
      }
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://api.sandbox.ebay.com/sell/inventory/v1/offer/offer-123/publish"
    );
  });

  it("builds eBay seller OAuth URLs and exchanges authorization codes", async () => {
    configureSandboxEbay();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "seller-access-token",
          expires_in: 7200,
          refresh_token: "seller-refresh-token",
          refresh_token_expires_in: 47304000
        }),
        { status: 200 }
      )
    );

    const provider = new EbayProvider();
    const consentUrl = new URL(provider.oauthConsentUrl("signed-state"));
    expect(consentUrl.origin).toBe("https://auth.sandbox.ebay.com");
    expect(consentUrl.searchParams.get("redirect_uri")).toBe("Watchbox-Watchbox-SBX-runame");
    expect(consentUrl.searchParams.get("scope")).toContain("sell.inventory");

    const tokenSet = await provider.exchangeAuthorizationCode("authorization-code");

    expect(tokenSet).toMatchObject({
      accessToken: "seller-access-token",
      refreshToken: "seller-refresh-token"
    });
    const tokenRequestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(tokenRequestBody).toBeInstanceOf(URLSearchParams);
    expect((tokenRequestBody as URLSearchParams).get("grant_type")).toBe("authorization_code");
    expect((tokenRequestBody as URLSearchParams).get("redirect_uri")).toBe("Watchbox-Watchbox-SBX-runame");
  });

  it("retrieves eBay seller identity from the identity API host", async () => {
    configureSandboxEbay();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userId: "seller-user-id",
          username: "watch-seller"
        }),
        { status: 200 }
      )
    );

    const provider = new EbayProvider();
    const seller = await provider.getSellerUser("seller-access-token");

    expect(seller).toEqual({
      ebayUserId: "seller-user-id",
      username: "watch-seller"
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://apiz.sandbox.ebay.com/commerce/identity/v1/user");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer seller-access-token"
      }
    });
  });

  it("returns not connected for a customer without an eBay seller connection", async () => {
    configureSandboxEbay();
    vi.spyOn(EbayConnectionModel, "findOne").mockResolvedValueOnce(null);

    const service = new EbayService();
    const status = await service.connectionStatus("dealer-1");

    expect(status).toEqual({
      connected: false,
      oauthConnected: false,
      canPublish: false,
      setupRequired: false,
      status: "not_connected",
      marketplaceId: "EBAY_US",
      connection: null
    });
  });

  it("returns the current eBay seller connection status for a customer", async () => {
    configureSandboxEbay();
    const connectedAt = new Date("2026-08-16T10:00:00.000Z");
    const lastSetupAt = new Date("2026-08-16T10:01:00.000Z");
    vi.spyOn(EbayConnectionModel, "findOne").mockResolvedValueOnce({
      _id: { toString: () => "connection-1" },
      userId: "dealer-1",
      dealerId: "dealer-1",
      ebayUserId: "ebay-user-1",
      marketplaceId: "EBAY_US",
      merchantLocationKey: "watchbox-dealer-1",
      fulfillmentPolicyId: "fulfillment-policy",
      paymentPolicyId: "payment-policy",
      returnPolicyId: "return-policy",
      status: "connected",
      connectedAt,
      lastSetupAt
    });

    const service = new EbayService();
    const status = await service.connectionStatus("dealer-1");

    expect(status).toMatchObject({
      connected: true,
      oauthConnected: true,
      canPublish: true,
      setupRequired: false,
      status: "connected",
      marketplaceId: "EBAY_US",
      connection: {
        id: "connection-1",
        userId: "dealer-1",
        dealerId: "dealer-1",
        ebayUserId: "ebay-user-1",
        marketplaceId: "EBAY_US",
        status: "connected",
        connectedAt: "2026-08-16T10:00:00.000Z",
        lastSetupAt: "2026-08-16T10:01:00.000Z",
        lastError: null
      }
    });
  });

  it("includes OAuth token error payloads in eBay authorization code exchange errors", async () => {
    configureSandboxEbay();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "the provided authorization grant code is invalid or was issued to another client"
        }),
        { status: 400 }
      )
    );

    const provider = new EbayProvider();

    await expect(provider.exchangeAuthorizationCode("authorization-code")).rejects.toMatchObject({
      code: "EBAY_API_ERROR",
      message:
        "eBay authorization code exchange failed with status 400: invalid_grant: the provided authorization grant code is invalid or was issued to another client",
      details: [
        {
          error: "invalid_grant",
          error_description: "the provided authorization grant code is invalid or was issued to another client"
        }
      ]
    });
  });

  it("normalizes short watch queries for direct eBay marketplace search through AI", async () => {
    configureSandboxEbay();
    process.env.AI_PROVIDER = "http";
    process.env.AI_SERVICE_URL = "https://api.openai.com/v1";
    process.env.AI_SERVICE_TOKEN = "ai-token";
    process.env.AI_MODEL = "vision-model";
    resetEnvForTests();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              optimizedQuery: "Rolex watch",
              confidence: 0.91,
              detectedBrand: "Rolex",
              detectedModel: null,
              reasoning: "Expanded incomplete luxury watch brand prefix."
            })
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));

    const service = new MarketplaceService();
    const result = await service.searchEbay({ q: "Role", limit: 20 });

    expect(result).toMatchObject({
      query: "Role",
      ebayQuery: "Rolex watch",
      queryNormalization: {
        source: "ai",
        confidence: 0.91,
        detectedBrand: "Rolex"
      },
      total: null,
      count: 0,
      warnings: [
        "eBay sandbox does not include live marketplace inventory. Use EBAY_ENVIRONMENT=production with production eBay Browse API credentials for real eBay results."
      ]
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
    expect((fetchMock.mock.calls[2]?.[0] as URL).href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=Rolex+watch&limit=20"
    );
  });

  it("builds eBay market analytics from active listing samples", async () => {
    configureSandboxEbay();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 42,
            itemSummaries: [
              {
                itemId: "v1|123|0",
                title: "Rolex Submariner 126610LN",
                price: { value: "12000.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/123",
                image: { imageUrl: "https://i.ebayimg.test/123.jpg" },
                condition: "Pre-Owned",
                seller: { username: "seller-a", feedbackScore: 1000, feedbackPercentage: "99.5" },
                buyingOptions: ["FIXED_PRICE"]
              },
              {
                itemId: "v1|456|0",
                title: "Rolex Submariner Date",
                price: { value: "14000.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/456",
                condition: "Pre-Owned",
                seller: { username: "seller-b", feedbackScore: 2000, feedbackPercentage: "98.5" },
                buyingOptions: ["AUCTION"]
              }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemId: "v1|123|0",
            title: "Rolex Submariner 126610LN",
            price: { value: "12000.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.com/itm/123",
            description: "Full eBay item description",
            condition: "Pre-Owned",
            seller: { username: "seller-a", feedbackScore: 1000, feedbackPercentage: "99.5" },
            buyingOptions: ["FIXED_PRICE"]
          }),
          { status: 200 }
        )
      );

    const service = new MarketplaceService();
    const analytics = await service.ebayAnalytics({
      q: "Rolex Submariner",
      itemId: "v1|123|0",
      limit: 100
    });

    expect(analytics.market).toMatchObject({
      averagePrice: 13000,
      lowerPrice: 12000,
      higherPrice: 14000,
      activeListingsTotal: 42,
      listingsVolume: 42,
      fixedPriceCount: 1,
      auctionCount: 1
    });
    expect(analytics.primaryProduct).toMatchObject({
      externalId: "v1|123|0",
      description: "Full eBay item description"
    });
    expect(analytics.sellerRating).toMatchObject({
      averageFeedbackScore: 1500,
      averagePositiveFeedbackPercentage: 99,
      ratedSellerCount: 2
    });
    expect(analytics.sales.totalSales).toBeNull();
    expect(analytics.similarListings).toHaveLength(2);
  });

  it("verifies an eBay seller from item detail reputation signals", async () => {
    configureSandboxEbay();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemId: "v1|123|0",
            title: "Rolex Submariner 126610LN",
            price: { value: "12000.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.com/itm/123",
            condition: "Pre-Owned",
            seller: {
              username: "watch-seller",
              feedbackScore: 1240,
              feedbackPercentage: "99.8",
              sellerAccountType: "BUSINESS"
            },
            buyingOptions: ["FIXED_PRICE"]
          }),
          { status: 200 }
        )
      );

    const service = new MarketplaceService();
    const verification = await service.verifyEbaySeller({
      itemId: "v1|123|0",
      q: "watch",
      limit: 20
    });

    expect(verification).toMatchObject({
      source: "item_detail",
      seller: {
        username: "watch-seller",
        feedbackScore: 1240,
        feedbackPercentage: 99.8,
        accountType: "BUSINESS"
      },
      verification: {
        verified: true,
        level: "trusted"
      },
      evidence: {
        activeListingsTotal: 1,
        sampledListings: 1
      }
    });
  });

  it("analyzes images through OpenAI-compatible HTTP credentials", async () => {
    process.env.AI_PROVIDER = "http";
    process.env.AI_SERVICE_URL = "https://api.openai.com/v1";
    process.env.AI_SERVICE_TOKEN = "ai-token";
    process.env.AI_MODEL = "vision-model";
    process.env.AI_EMBEDDING_MODEL = "embedding-model";
    resetEnvForTests();

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              containsWatch: true,
              probableBrand: "Rolex",
              probableModel: "Daytona",
              probableReferenceNumber: "116500LN",
              visualAttributes: { dial: "white" }
            })
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
      );

    const provider = new HttpAiProvider();
    const analysis = await provider.analyzeImage({ imageUrl: "https://example.test/watch.jpg" });

    expect(analysis).toMatchObject({
      containsWatch: true,
      probableBrand: "Rolex",
      probableModel: "Daytona",
      probableReferenceNumber: "116500LN",
      visualAttributes: { dial: "white" },
      embedding: [0.1, 0.2, 0.3],
      modelVersion: "vision-model"
    });
    const responsesCall = fetchMock.mock.calls[0];
    expect(responsesCall?.[0]).toBe("https://api.openai.com/v1/responses");
    expect(responsesCall?.[1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer ai-token" }
    });
    const rawResponseBody = responsesCall?.[1]?.body;
    const responseBody = JSON.parse(typeof rawResponseBody === "string" ? rawResponseBody : "{}") as {
      text?: {
        format?: {
          schema?: {
            properties?: {
              visualAttributes?: {
                additionalProperties?: boolean;
              };
            };
          };
        };
      };
    };
    expect(responseBody.text?.format?.schema?.properties?.visualAttributes).toMatchObject({
      additionalProperties: false
    });

    const embeddingsCall = fetchMock.mock.calls[1];
    expect(embeddingsCall?.[0]).toBe("https://api.openai.com/v1/embeddings");
    expect(embeddingsCall?.[1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer ai-token" }
    });
  });

  it("skips embeddings for fast OpenAI image search analysis", async () => {
    process.env.AI_PROVIDER = "http";
    process.env.AI_SERVICE_URL = "https://api.openai.com/v1";
    process.env.AI_SERVICE_TOKEN = "ai-token";
    process.env.AI_MODEL = "vision-model";
    process.env.AI_EMBEDDING_MODEL = "embedding-model";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            containsWatch: true,
            probableBrand: "Rolex",
            probableModel: "Submariner",
            probableReferenceNumber: "126610LN",
            visualAttributes: { dialColor: "black" }
          })
        }),
        { status: 200 }
      )
    );

    const provider = new HttpAiProvider();
    const analysis = await provider.analyzeImage({
      imageUrl: "https://example.test/watch.jpg",
      includeEmbedding: false
    });

    expect(analysis.embedding).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes marketplace search queries through OpenAI-compatible credentials", async () => {
    process.env.AI_PROVIDER = "http";
    process.env.AI_SERVICE_URL = "https://api.openai.com/v1";
    process.env.AI_SERVICE_TOKEN = "ai-token";
    process.env.AI_MODEL = "vision-model";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            optimizedQuery: "Rolex watch",
            confidence: 0.9,
            detectedBrand: "Rolex",
            detectedModel: null,
            reasoning: "Expanded incomplete brand query."
          })
        }),
        { status: 200 }
      )
    );

    const provider = new HttpAiProvider();
    const result = await provider.normalizeSearchQuery({ query: "Role" });

    expect(result).toMatchObject({
      optimizedQuery: "Rolex watch",
      confidence: 0.9,
      detectedBrand: "Rolex",
      reasoning: "Expanded incomplete brand query.",
      modelVersion: "vision-model"
    });
    const responsesCall = fetchMock.mock.calls[0];
    expect(responsesCall?.[0]).toBe("https://api.openai.com/v1/responses");
    const rawResponseBody = responsesCall?.[1]?.body;
    const responseBody = JSON.parse(typeof rawResponseBody === "string" ? rawResponseBody : "{}") as {
      text?: {
        format?: {
          name?: string;
        };
      };
    };
    expect(responseBody.text?.format?.name).toBe("watch_search_query");
  });
});
