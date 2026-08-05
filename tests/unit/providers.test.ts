import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpAiProvider, LocalAiProvider } from "../../src/infrastructure/external/ai/ai-provider.js";
import { EbayProvider } from "../../src/infrastructure/external/ebay/ebay-provider.js";
import { LocalEmailProvider } from "../../src/infrastructure/external/email/email-provider.js";
import { LocalPaymentProvider } from "../../src/infrastructure/external/stripe/stripe-provider.js";
import { MarketplaceService } from "../../src/modules/customer/marketplaces/marketplaces.service.js";
import { resetEnvForTests } from "../../src/config/env.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
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
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

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

  it("normalizes short watch queries for direct eBay marketplace search through AI", async () => {
    process.env.AI_PROVIDER = "http";
    process.env.AI_SERVICE_URL = "https://api.openai.com/v1";
    process.env.AI_SERVICE_TOKEN = "ai-token";
    process.env.AI_MODEL = "vision-model";
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
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
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

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
