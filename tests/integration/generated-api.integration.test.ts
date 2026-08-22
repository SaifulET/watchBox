import { createHmac } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { getDatabaseConfig } from "../../src/config/database.config.js";
import { getEnv, resetEnvForTests } from "../../src/config/env.js";
import {
  AdminAccountModel,
  AuthSessionModel,
  CustomerAccountModel
} from "../../src/modules/customer/auth/auth.model.js";
import { PasswordService } from "../../src/modules/customer/auth/password.service.js";
import { GeneratedApiRecordModel } from "../../src/modules/generated-api/generated-api.model.js";

process.env.STORAGE_PROVIDER = "local";
process.env.EMAIL_PROVIDER = "local";
process.env.AI_PROVIDER = "local";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_ELITE_PRICE_ID;
resetEnvForTests();

const app = createApp();

type DataResponse<TData> = {
  success: true;
  data: TData;
};

type AuthResponse = DataResponse<{
  account: {
    id: string;
  };
  tokens: {
    accessToken: string;
  };
}>;

type RecordResponse = DataResponse<{
  id: string;
  data: Record<string, unknown>;
  status: string;
}>;

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

const connectForTests = async (): Promise<void> => {
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: `${config.databaseName}-test`,
    autoIndex: true
  });
};

const registerCustomer = async (): Promise<string> => {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: "generated-customer@example.com",
      password: "generated-password",
      displayName: "Generated Customer"
    })
    .expect(201);
  const body = response.body as AuthResponse;
  return body.data.tokens.accessToken;
};

const loginAdmin = async (): Promise<string> => {
  const passwords = new PasswordService();
  await AdminAccountModel.create({
    email: "generated-admin@example.com",
    displayName: "Generated Admin",
    passwordHash: await passwords.hash("admin-password"),
    permissions: ["admin:dashboard", "admin:settings"],
    roles: ["dashboard-admin"]
  });

  const response = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ email: "generated-admin@example.com", password: "admin-password" })
    .expect(200);
  const body = response.body as AuthResponse;
  return body.data.tokens.accessToken;
};

describe.sequential("generated API routes", () => {
  beforeAll(async () => {
    await connectForTests();
  });

  beforeEach(async () => {
    await Promise.all([
      CustomerAccountModel.deleteMany({}),
      AdminAccountModel.deleteMany({}),
      AuthSessionModel.deleteMany({}),
      GeneratedApiRecordModel.deleteMany({})
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.EBAY_CLIENT_SECRET;
    delete process.env.EBAY_ENVIRONMENT;
    delete process.env.EBAY_MARKETPLACE_ID;
    delete process.env.EBAY_API_BASE_URL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_ELITE_PRICE_ID;
    resetEnvForTests();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("serves public catalogue reads from the generated API layer", async () => {
    const response = await request(app).get("/api/v1/brands").expect(200);
    const body = response.body as DataResponse<unknown[]> & { meta: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("persists and updates a customer-owned listing record", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const createdResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({ title: "Rolex Submariner", price: 12500, currency: "USD" })
      .expect(201);
    const created = createdResponse.body as RecordResponse;
    expect(created.data.data.title).toBe("Rolex Submariner");

    const updatedResponse = await request(app)
      .patch(`/api/v1/listings/${created.data.id}`)
      .set("Authorization", authorization)
      .send({ price: 11900 })
      .expect(200);
    const updated = updatedResponse.body as RecordResponse;
    expect(updated.data.data.price).toBe(11900);

    const publishedResponse = await request(app)
      .post(`/api/v1/listings/${created.data.id}/publish`)
      .set("Authorization", authorization)
      .send({})
      .expect(200);
    const published = publishedResponse.body as DataResponse<{ record: { status: string } }>;
    expect(published.data.record.status).toBe("active");
  });

  it("uploads an image to a customer-owned listing", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const createdResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({ title: "Image Listing", price: 5000, currency: "USD" })
      .expect(201);
    const created = createdResponse.body as RecordResponse;

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    const uploadResponse = await request(app)
      .post(`/api/v1/listings/${created.data.id}/images`)
      .set("Authorization", authorization)
      .attach("image", png, {
        filename: "watch.png",
        contentType: "image/png"
      })
      .expect(201);
    const upload = uploadResponse.body as DataResponse<{ image: string }>;

    expect(upload.data.image).toContain(created.data.id);

    const replaceResponse = await request(app)
      .post(`/api/v1/listings/${created.data.id}/images`)
      .set("Authorization", authorization)
      .attach("image", png, {
        filename: "watch-replacement.png",
        contentType: "image/png"
      })
      .expect(201);
    const replacement = replaceResponse.body as DataResponse<{ image: string }>;
    expect(replacement.data.image).toContain(created.data.id);
    expect(replacement.data.image).not.toBe(upload.data.image);

    const imagesResponse = await request(app)
      .get(`/api/v1/listings/${created.data.id}/images`)
      .set("Authorization", authorization)
      .expect(200);
    const images = imagesResponse.body as DataResponse<{ image: string | null }>;
    expect(Object.keys(images.data)).toEqual(["image"]);
    expect(images.data.image).toBe(replacement.data.image);

    const listingResponse = await request(app)
      .get(`/api/v1/listings/${created.data.id}`)
      .expect(200);
    const listing = listingResponse.body as RecordResponse;
    expect(listing.data.data.image).toBe(replacement.data.image);
    expect(listing.data.data.images).toBeUndefined();
  });

  it("creates and updates a listing with an inline image file", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );

    const createdResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .field("title", "Inline Image Listing")
      .field("brand", "Rolex")
      .field("price", "12500")
      .field("currency", "USD")
      .attach("image", png, {
        filename: "create.png",
        contentType: "image/png"
      })
      .expect(201);
    const created = createdResponse.body as RecordResponse;
    const createdImage = created.data.data.image;
    expect(created.data.data.price).toBe(12500);
    expect(typeof createdImage).toBe("string");
    expect(created.data.data.images).toBeUndefined();

    const updatedResponse = await request(app)
      .patch(`/api/v1/listings/${created.data.id}`)
      .set("Authorization", authorization)
      .field("title", "Updated Inline Image Listing")
      .field("price", "11900")
      .attach("image", png, {
        filename: "update.png",
        contentType: "image/png"
      })
      .expect(200);
    const updated = updatedResponse.body as RecordResponse;
    expect(updated.data.data.title).toBe("Updated Inline Image Listing");
    expect(updated.data.data.price).toBe(11900);
    expect(typeof updated.data.data.image).toBe("string");
    expect(updated.data.data.image).not.toBe(createdImage);
    expect(updated.data.data.images).toBeUndefined();
  });

  it("rejects duplicate listing titles and no-op updates", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const createdResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({ title: "Unique Listing", price: 12500, currency: "USD" })
      .expect(201);
    const created = createdResponse.body as RecordResponse;

    const duplicateResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({ title: "unique listing", price: 13000, currency: "USD" })
      .expect(409);
    const duplicate = duplicateResponse.body as ErrorResponse;
    expect(duplicate.error.code).toBe("RESOURCE_CONFLICT");
    expect(duplicate.error.message).toBe("Listing title must be unique. Please use a different title.");

    const emptyUpdateResponse = await request(app)
      .patch(`/api/v1/listings/${created.data.id}`)
      .set("Authorization", authorization)
      .send({})
      .expect(409);
    const emptyUpdate = emptyUpdateResponse.body as ErrorResponse;
    expect(emptyUpdate.error.message).toBe("No listing changes were provided.");

    const noChangeResponse = await request(app)
      .patch(`/api/v1/listings/${created.data.id}`)
      .set("Authorization", authorization)
      .send({ title: "Unique Listing", price: 12500 })
      .expect(409);
    const noChange = noChangeResponse.body as ErrorResponse;
    expect(noChange.error.message).toBe("No listing changes were detected.");
  });

  it("searches local listings and eBay from a keyword", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), { status: 200 });
      }
      if (url.includes("/item_summary/search")) {
        return new Response(
          JSON.stringify({
            itemSummaries: [
              {
                itemId: "v1|123|0",
                title: "Rolex Submariner Date",
                price: { value: "12500.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/123",
                image: { imageUrl: "https://i.ebayimg.test/123.jpg" },
                condition: "Pre-Owned",
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes("direct-text-watch")) {
        return new Response(
          JSON.stringify({
            itemId: "direct-text-watch",
            title: "Titan automatic blue skeleton watch",
            price: { value: "180.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.test/itm/direct-text-watch",
            image: { imageUrl: "https://i.ebayimg.test/titan.jpg" },
            condition: "New",
            buyingOptions: ["FIXED_PRICE"],
            localizedAspects: [
              { name: "Brand", value: "Titan" },
              { name: "Model", value: "Skeleton" },
              { name: "Reference Number", value: "90123QM01" }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        model: "Submariner",
        referenceNumber: "126610LN",
        price: 12500,
        currency: "USD"
      })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/ai/search")
      .set("Authorization", authorization)
      .send({ query: "Role", limit: 5 })
      .expect(201);
    const body = response.body as DataResponse<{
      query: string;
      image: string | null;
      metadata: {
        ebayQuery: string;
        queryNormalization: {
          ebay: {
            source: string;
          };
        };
      };
      results: {
        items: Array<{
          source: string;
          title: string;
          similarityScore: number;
          matchReasons: string[];
        }>;
        local: Array<{ source: string; title: string; image: string | null }>;
        ebay: Array<{ source: string; title: string; image: string | null }>;
      };
      errors: Record<string, string>;
    }>;

    expect(body.data.query).toBe("Role");
    expect(body.data.metadata.ebayQuery).toBe("Role watch");
    expect(body.data.metadata.queryNormalization.ebay.source).toBe("ai");
    expect(body.data.image).toBeNull();
    expect(body.data.results.local[0]).toMatchObject({
      source: "local",
      title: "Rolex Submariner 126610LN"
    });
    expect(body.data.results.ebay[0]).toMatchObject({
      source: "ebay",
      title: "Rolex Submariner Date",
      image: "https://i.ebayimg.test/123.jpg"
    });
    expect((fetchMock.mock.calls[1]?.[0] as URL).href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=Role+watch&limit=5"
    );
    expect(body.data.results.items[0]).toMatchObject({
      source: "ebay",
      title: "Rolex Submariner Date"
    });
    expect(body.data.results.items.some((item) => item.source === "local")).toBe(true);
    expect(body.data.results.items[0]?.similarityScore).toBeGreaterThanOrEqual(
      body.data.results.items[1]?.similarityScore ?? 0
    );
    const rankedLocal = body.data.results.items.find((item) => item.source === "local");
    expect(rankedLocal?.matchReasons).toEqual(expect.arrayContaining(["brand:role"]));
    expect(body.data.errors).toBeUndefined();
  });

  it("searches eBay directly from text without AI query normalization", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), { status: 200 });
      }
      if (url.includes("/item_summary/search")) {
        return new Response(
          JSON.stringify({
            itemSummaries: [
              {
                itemId: "direct-text-watch",
                title: "Titan automatic blue skeleton watch",
                price: { value: "180.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.test/itm/direct-text-watch",
                image: { imageUrl: "https://i.ebayimg.test/titan.jpg" },
                condition: "New",
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes("direct-text-watch")) {
        return new Response(
          JSON.stringify({
            itemId: "direct-text-watch",
            title: "Titan automatic blue skeleton watch",
            price: { value: "180.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.test/itm/direct-text-watch",
            image: { imageUrl: "https://i.ebayimg.test/titan.jpg" },
            condition: "New",
            buyingOptions: ["FIXED_PRICE"],
            localizedAspects: [
              { name: "Brand", value: "Titan" },
              { name: "Model", value: "Skeleton" },
              { name: "Reference Number", value: "90123QM01" }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    const accessToken = await registerCustomer();
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "Titan blue skeleton automatic watch",
        brand: "Titan",
        model: "Skeleton",
        price: 190,
        currency: "USD",
        condition: "new"
      })
      .expect(201);
    const response = await request(app)
      .post("/api/v1/image-search/ebay-direct")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ query: "Titan blue skeleton", limit: 5 })
      .expect(201);
    const body = response.body as DataResponse<{
      mode: string;
      flow: string;
      query: string;
      imageAnalysis: null;
      metadata: {
        internalProductsMerged: boolean;
        localCandidates: number;
        ebayCandidates: number;
        ebayDetailEnriched: number;
        textSearchDirectToEbay: boolean;
        imageSearchUsesOpenAiIdentification: boolean;
        queryNormalization: { source: string };
      };
      results: {
        items: Array<{ source: string; title: string; brand: string | null; model: string | null; referenceNumber: string | null }>;
        local: Array<{ source: string; title: string }>;
        ebay: Array<{ source: string; title: string; brand: string | null; model: string | null; referenceNumber: string | null }>;
      };
    }>;
    const searchUrl = fetchMock.mock.calls
      .map((call) => call[0])
      .find((value): value is URL => value instanceof URL && value.pathname.includes("/item_summary/search"));

    expect(body.data.mode).toBe("text");
    expect(body.data.flow).toBe("User query -> eBay directly + internal products");
    expect(body.data.query).toBe("Titan blue skeleton");
    expect(body.data.imageAnalysis).toBeNull();
    expect(body.data.metadata.internalProductsMerged).toBe(true);
    expect(body.data.metadata.localCandidates).toBe(1);
    expect(body.data.metadata.ebayCandidates).toBe(1);
    expect(body.data.metadata.ebayDetailEnriched).toBe(1);
    expect(body.data.metadata.textSearchDirectToEbay).toBe(true);
    expect(body.data.metadata.imageSearchUsesOpenAiIdentification).toBe(false);
    expect(body.data.metadata.queryNormalization.source).toBe("fallback");
    expect(searchUrl?.searchParams.get("q")).toBe("Titan blue skeleton");
    expect(body.data.results.local[0]).toMatchObject({
      source: "local",
      title: "Titan blue skeleton automatic watch"
    });
    expect(body.data.results.ebay[0]).toMatchObject({
      source: "ebay",
      title: "Titan automatic blue skeleton watch",
      brand: "Titan",
      model: "Skeleton",
      referenceNumber: "90123QM01"
    });
    expect(body.data.results.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "local", title: "Titan blue skeleton automatic watch" }),
      expect.objectContaining({ source: "ebay", title: "Titan automatic blue skeleton watch" })
    ]));
  });

  it("searches eBay directly from an uploaded image with search_by_image", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), { status: 200 });
      }
      if (url.includes("/item_summary/search_by_image")) {
        return new Response(
          JSON.stringify({
            itemSummaries: [
              {
                itemId: "direct-image-watch",
                title: "Rolex Submariner 126610LN",
                price: { value: "12600.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.test/itm/direct-image-watch",
                image: { imageUrl: "https://i.ebayimg.test/rolex.jpg" },
                condition: "Pre-Owned",
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (url.includes("/buy/browse/v1/item/direct-image-watch")) {
        return new Response(
          JSON.stringify({
            itemId: "direct-image-watch",
            title: "Rolex Submariner 126610LN",
            price: { value: "12600.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.test/itm/direct-image-watch",
            image: { imageUrl: "https://i.ebayimg.test/rolex.jpg" },
            condition: "Pre-Owned",
            buyingOptions: ["FIXED_PRICE"],
            localizedAspects: [
              { name: "Brand", value: "Rolex" },
              { name: "Model", value: "Submariner" },
              { name: "Reference Number", value: "126610LN" }
            ]
          }),
          { status: 200 }
        );
      }
      if (url === "https://i.localimg.test/rolex.png") {
        return new Response(png, { status: 200, headers: { "content-type": "image/png" } });
      }
      return new Response("not found", { status: 404 });
    });

    const accessToken = await registerCustomer();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    await GeneratedApiRecordModel.create({
      resource: "listings",
      ownerId: "internal-test-owner",
      scope: {},
      status: "active",
      data: {
        title: "Internal Rolex Submariner visual match",
        brand: "Rolex",
        model: "Submariner",
        price: 12500,
        currency: "USD",
        condition: "very_good",
        image: "https://i.localimg.test/rolex.png"
      },
      history: []
    });
    const response = await request(app)
      .post("/api/v1/image-search/ebay-direct")
      .set("Authorization", `Bearer ${accessToken}`)
      .field("limit", "5")
      .attach("file", png, {
        filename: "watch.png",
        contentType: "image/png"
      })
      .expect(201);
    const body = response.body as DataResponse<{
      mode: string;
      flow: string;
      query: string;
      imageAnalysis: null;
      metadata: {
        internalProductsMerged: boolean;
        localCandidates: number;
        ebayCandidates: number;
        ebayDetailEnriched: number;
        textSearchDirectToEbay: boolean;
        imageSearchUsesOpenAiIdentification: boolean;
        imageSearchUsesEbayImageSearch: boolean;
      };
      results: {
        items: Array<{ source: string; title: string; visualSimilarity: number | null }>;
        local: Array<{ source: string; title: string; visualSimilarity: number | null }>;
        ebay: Array<{ source: string; title: string; brand: string | null; model: string | null; referenceNumber: string | null }>;
      };
    }>;
    const searchUrl = fetchMock.mock.calls
      .map((call) => call[0])
      .find((value): value is URL => value instanceof URL && value.pathname.includes("/item_summary/search_by_image"));
    const imageSearchCall = fetchMock.mock.calls.find((call) => {
      const value = call[0];
      return value instanceof URL && value.pathname.includes("/item_summary/search_by_image");
    });
    const imageSearchBody = JSON.parse(String(imageSearchCall?.[1]?.body ?? "{}")) as { image?: string };

    expect(body.data.mode).toBe("image");
    expect(body.data.flow).toBe("Image -> eBay search_by_image + internal visual match");
    expect(body.data.imageAnalysis).toBeNull();
    expect(body.data.metadata.internalProductsMerged).toBe(true);
    expect(body.data.metadata.localCandidates).toBe(1);
    expect(body.data.metadata.ebayCandidates).toBe(1);
    expect(body.data.metadata.ebayDetailEnriched).toBe(1);
    expect(body.data.metadata.textSearchDirectToEbay).toBe(false);
    expect(body.data.metadata.imageSearchUsesOpenAiIdentification).toBe(false);
    expect(body.data.metadata.imageSearchUsesEbayImageSearch).toBe(true);
    expect(searchUrl?.searchParams.get("limit")).toBe("5");
    expect(typeof imageSearchBody.image).toBe("string");
    expect(imageSearchBody.image?.length).toBeGreaterThan(0);
    expect(body.data.results.local[0]).toMatchObject({
      source: "local",
      title: "Internal Rolex Submariner visual match",
      visualSimilarity: expect.any(Number)
    });
    expect(body.data.results.ebay[0]).toMatchObject({
      source: "ebay",
      title: "Rolex Submariner 126610LN",
      brand: "Rolex",
      model: "Submariner",
      referenceNumber: "126610LN"
    });
    expect(body.data.results.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "local", title: "Internal Rolex Submariner visual match" }),
      expect.objectContaining({ source: "ebay", title: "Rolex Submariner 126610LN" })
    ]));
  });

  it("detects a search query from an uploaded image", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ itemSummaries: [] }), { status: 200 }));

    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        model: "Submariner",
        referenceNumber: "126610LN",
        price: 12500,
        currency: "USD"
      })
      .expect(201);
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Datejust 126334",
        brand: "Rolex",
        model: "Datejust",
        referenceNumber: "126334",
        price: 9800,
        currency: "USD"
      })
      .expect(201);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    const response = await request(app)
      .post("/api/v1/image-search")
      .set("Authorization", authorization)
      .attach("file", png, {
        filename: "watch.png",
        contentType: "image/png"
      })
      .expect(201);
    const body = response.body as DataResponse<
      Array<{
        source: string;
        title: string;
        similarityScore: number;
        currentPrice: number | null;
        marketAveragePrice: number | null;
        marketStatus: string;
        salesAmount: number | null;
        lowestPrice: number | null;
        highestPrice: number | null;
        liquidityScope: string;
        volatility: string;
      }>
    >;

    const searchUrl = fetchMock.mock.calls
      .map((call) => call[0])
      .find((value): value is URL =>
        value instanceof URL &&
        value.pathname.includes("/item_summary/search") &&
        value.searchParams.get("q") === "Rolex Submariner 126610LN" &&
        value.searchParams.get("limit") === "20"
      );
    expect(searchUrl?.pathname).toBe("/buy/browse/v1/item_summary/search");
    expect(searchUrl?.searchParams.get("q")).toBe("Rolex Submariner 126610LN");
    expect(searchUrl?.searchParams.get("limit")).toBe("20");
    expect(body.data[0]).toMatchObject({
      source: "local",
      title: "Rolex Submariner 126610LN",
      currentPrice: 12500,
      marketAveragePrice: 12500,
      marketStatus: "stable",
      salesAmount: 0,
      lowestPrice: 12500,
      highestPrice: 12500,
      liquidityScope: "low",
      volatility: "medium",
    });
    expect(body.data[0]).not.toHaveProperty("similarProducts");
    expect(body.data[0]?.similarityScore).toBeGreaterThan(0);
    expect(body.data.map((item) => item.title)).not.toContain("Rolex Datejust 126334");
  });

  it("prioritizes image brand and visual attributes for eBay image search results", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    process.env.EBAY_API_BASE_URL = "https://api.sandbox.ebay.com";
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
            itemSummaries: [
              {
                itemId: "blue-watch",
                title: "Rolex Submariner 126610LN watch blue dial",
                price: { value: "12400", currency: "USD" },
                itemWebUrl: "https://www.ebay.test/itm/blue-watch",
                image: { imageUrl: "https://i.ebayimg.test/blue.jpg" },
                condition: "Pre-Owned",
                buyingOptions: ["FIXED_PRICE"],
                localizedAspects: [
                  { name: "Brand", value: "Rolex" },
                  { name: "Model", value: "Submariner" },
                  { name: "Reference Number", value: "126610LN" },
                  { name: "Dial Color", value: "Blue" },
                  { name: "Bezel", value: "Steel" },
                  { name: "Case Shape", value: "Square" }
                ]
              },
              {
                itemId: "black-watch",
                title: "Rolex Submariner 126610LN watch black dial",
                price: { value: "12600", currency: "USD" },
                itemWebUrl: "https://www.ebay.test/itm/black-watch",
                image: { imageUrl: "https://i.ebayimg.test/black.jpg" },
                condition: "Pre-Owned",
                buyingOptions: ["FIXED_PRICE"],
                localizedAspects: [
                  { name: "Brand", value: "Rolex" },
                  { name: "Model", value: "Submariner" },
                  { name: "Reference Number", value: "126610LN" },
                  { name: "Dial Color", value: "Black" },
                  { name: "Bezel", value: "Ceramic" },
                  { name: "Case Shape", value: "Round" }
                ]
              }
            ]
          }),
          { status: 200 }
        )
      );

    const accessToken = await registerCustomer();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    const response = await request(app)
      .post("/api/v1/image-search")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", png, {
        filename: "watch.png",
        contentType: "image/png"
      })
      .expect(201);
    const body = response.body as DataResponse<Array<{ id: string; matchReasons: string[] }>>;

    expect(body.data[0]).toMatchObject({
      id: "black-watch",
      matchReasons: expect.arrayContaining([
        "priority:brand",
        "priority:model",
        "priority:reference",
        "priority:visual:black",
        "priority:visual:ceramic",
        "priority:visual:round"
      ])
    });
  });

  it("runs the visual image search pipeline with candidate image comparison and confidence", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    process.env.EBAY_API_BASE_URL = "https://api.sandbox.ebay.com";
    resetEnvForTests();
    const blackPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWNgIB0AAAA0AAEjQ4N1AAAAAElFTkSuQmCC",
      "base64"
    );
    const bluePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWNgYPiPhIjiAACOsw/xX0IioQAAAABJRU5ErkJggg==",
      "base64"
    );
    const ebaySearchResponse = {
      itemSummaries: [
        {
          itemId: "blue-watch",
          title: "Rolex Submariner 126610LN watch blue dial",
          price: { value: "12400", currency: "USD" },
          itemWebUrl: "https://www.ebay.test/itm/blue-watch",
          image: { imageUrl: "https://i.ebayimg.test/blue.jpg" },
          condition: "Pre-Owned",
          buyingOptions: ["FIXED_PRICE"],
          localizedAspects: [
            { name: "Brand", value: "Rolex" },
            { name: "Model", value: "Submariner" },
            { name: "Reference Number", value: "126610LN" },
            { name: "Dial Color", value: "Blue" }
          ]
        },
        {
          itemId: "black-watch",
          title: "Rolex Submariner 126610LN watch black dial",
          price: { value: "12600", currency: "USD" },
          itemWebUrl: "https://www.ebay.test/itm/black-watch",
          image: { imageUrl: "https://i.ebayimg.test/black.jpg" },
          condition: "Pre-Owned",
          buyingOptions: ["FIXED_PRICE"],
          localizedAspects: [
            { name: "Brand", value: "Rolex" },
            { name: "Model", value: "Submariner" },
            { name: "Reference Number", value: "126610LN" },
            { name: "Dial Color", value: "Black" },
            { name: "Bezel", value: "Ceramic" },
            { name: "Case Shape", value: "Round" }
          ]
        }
      ]
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), { status: 200 });
      }
      if (url.includes("/item_summary/search")) {
        return new Response(JSON.stringify(ebaySearchResponse), { status: 200 });
      }
      if (url === "https://i.ebayimg.test/black.jpg") {
        return new Response(blackPng, { status: 200, headers: { "content-type": "image/png" } });
      }
      if (url === "https://i.ebayimg.test/blue.jpg") {
        return new Response(bluePng, { status: 200, headers: { "content-type": "image/png" } });
      }
      return new Response("not found", { status: 404 });
    });

    const accessToken = await registerCustomer();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );
    const response = await request(app)
      .post("/api/v1/image-search/visual")
      .set("Authorization", `Bearer ${accessToken}`)
      .field("limit", "2")
      .attach("file", png, {
        filename: "watch.png",
        contentType: "image/png"
      })
      .expect(201);
    const body = response.body as DataResponse<{
      pipeline: string[];
      quality: { passed: boolean };
      queryEmbeddingDimensions: number;
      metadata: { analyzedCandidateImages: number; candidateImageEmbeddings: boolean; marketplaceCandidates: { ebay: number } };
      results: {
        items: Array<{
          id: string;
          confidence: number;
          marketplace: string;
          originalUrl: string;
          visualSimilarity: number | null;
          metadataSimilarity: number;
          matchScore: number;
          matchLevel: string;
          matchedOn: string[];
          confidenceBreakdown: {
            imageSimilarity: number | null;
            visualAttributes: number;
            metadata: number;
            text: number;
          };
          matchReasons: string[];
          candidateImageAnalysis: unknown;
        }>;
      };
    }>;

    expect(body.data.pipeline).toEqual([
      "image_quality_check",
      "extract_visual_attributes",
      "generate_image_embedding",
      "search_marketplace_candidates",
      "compare_candidate_images_and_metadata",
      "multi_signal_ranking",
      "return_top_matches_with_confidence"
    ]);
    expect(body.data.quality.passed).toBe(true);
    expect(body.data.queryEmbeddingDimensions).toBeGreaterThan(0);
    expect(body.data.metadata.analyzedCandidateImages).toBeGreaterThan(0);
    expect(body.data.metadata.candidateImageEmbeddings).toBe(true);
    expect(body.data.metadata.marketplaceCandidates.ebay).toBe(2);
    expect(body.data.results.items[0]).toMatchObject({
      id: "black-watch",
      marketplace: "ebay",
      originalUrl: "https://www.ebay.test/itm/black-watch",
      visualSimilarity: expect.any(Number),
      metadataSimilarity: expect.any(Number),
      matchScore: expect.any(Number),
      matchLevel: expect.stringMatching(/^(very_high|high|possible|low)$/),
      matchedOn: expect.arrayContaining(["dial:black", "case:ceramic", "case:round"]),
      confidence: expect.any(Number),
      confidenceBreakdown: {
        imageSimilarity: expect.any(Number),
        visualAttributes: expect.any(Number),
        metadata: expect.any(Number),
        text: expect.any(Number)
      },
      matchReasons: expect.arrayContaining(["dial:black", "case:ceramic", "case:round"]),
      candidateImageAnalysis: null
    });
  });

  it("accepts keyword-only visual image search requests", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Titan Edge Ceramic Watch",
        brand: "Titan",
        model: "Edge",
        price: 250,
        currency: "USD",
        condition: "new"
      })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/image-search/visual")
      .set("Authorization", authorization)
      .field("keyword", "titan")
      .expect(201);
    const body = response.body as DataResponse<{
      query: string;
      queryImageAnalysis: null;
      queryEmbeddingDimensions: number;
      pipeline: string[];
      results: {
        items: Array<{
          title: string;
          confidence: number;
          confidenceBreakdown: {
            imageSimilarity: null;
            visualAttributes: number;
            metadata: number;
            text: number;
          };
        }>;
      };
    }>;

    expect(body.data.query).toBe("titan");
    expect(body.data.queryImageAnalysis).toBeNull();
    expect(body.data.queryEmbeddingDimensions).toBe(0);
    expect(body.data.pipeline).toEqual([
      "keyword_search",
      "search_marketplace_candidates",
      "multi_signal_ranking",
      "return_top_matches_with_confidence"
    ]);
    expect(body.data.results.items[0]).toMatchObject({
      title: "Titan Edge Ceramic Watch",
      confidence: expect.any(Number),
      confidenceBreakdown: {
        imageSimilarity: null,
        visualAttributes: 0,
        metadata: 0,
        text: expect.any(Number)
      }
    });
  });

  it("returns enriched details for one local product by ID", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    const listingResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        model: "Submariner",
        referenceNumber: "126610LN",
        price: 12500,
        currency: "USD",
        condition: "excellent",
        movement: "automatic",
        scope: "full set",
        productionYear: 2021,
        description: "Rolex Submariner full set in excellent condition."
      })
      .expect(201);
    const listingBody = listingResponse.body as DataResponse<{ id: string }>;

    const response = await request(app)
      .get(`/api/v1/products/local/${listingBody.data.id}/details`)
      .set("Authorization", authorization)
      .expect(200);
    const body = response.body as DataResponse<{
      id: string;
      title: string;
      brand: string;
      model: string;
      referenceNumber: string;
      currentPrice: number;
      productionYear: number;
      movement: string;
      scope: string;
      image: string;
      sourceUrl: string;
      similarProducts: Array<{ title: string; price: number; condition: string }>;
    }>;

    expect(body.data).toMatchObject({
      id: listingBody.data.id,
      title: "Rolex Submariner 126610LN",
      brand: "Rolex",
      model: "Submariner",
      referenceNumber: "126610LN",
      currentPrice: 12500,
      productionYear: 2021,
      movement: "automatic",
      scope: "full set"
    });
    expect(body.data.image).not.toBe("");
    expect(body.data.sourceUrl).toBe(`/api/v1/listings/${listingBody.data.id}`);
    expect(body.data.similarProducts).toHaveLength(5);
    expect(body.data.similarProducts[0]).toMatchObject({
      title: expect.any(String),
      price: expect.any(Number),
      condition: expect.any(String)
    });
  });

  it("filters product search by keyword, brand, model, price, status, condition, and region", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        model: "Submariner",
        price: 12500,
        currency: "USD",
        condition: "very good",
        region: "United States",
        listingStatus: "active"
      })
      .expect(201);
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Omega Seamaster",
        brand: "Omega",
        model: "Seamaster",
        price: 6200,
        currency: "USD",
        condition: "new",
        region: "United Kingdom",
        listingStatus: "active"
      })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/image-search")
      .set("Authorization", authorization)
      .field("keyword", "Submariner")
      .field("brand", "Rolex")
      .field("model", "Submariner")
      .field("minPrice", "10000")
      .field("maxPrice", "14000")
      .field("listingStatus", "active")
      .field("condition", "very_good")
      .field("region", "United States")
      .expect(201);
    const body = response.body as DataResponse<Array<{ title: string; brand: string; model: string; currentPrice: number; condition: string }>>;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      title: "Rolex Submariner 126610LN",
      brand: "Rolex",
      model: "Submariner",
      currentPrice: 12500,
      condition: "very good"
    });
  });

  it("searches eBay by latitude and longitude after resolving a postal code", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.includes("nominatim.openstreetmap.org/reverse")) {
        return new Response(
          JSON.stringify({
            display_name: "New York, NY 10007, United States",
            address: {
              postcode: "10007",
              country_code: "us",
              city: "New York",
              state: "New York"
            }
          }),
          { status: 200 }
        );
      }
      if (url.includes("/identity/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        });
      }
      if (url.includes("/buy/browse/v1/item_summary/search")) {
        return new Response(
          JSON.stringify({
            total: 1,
            itemSummaries: [
              {
                itemId: "v1|loc|0",
                title: "Rolex Submariner New York",
                price: { value: "12500.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/loc",
                condition: "Pre-Owned",
                itemLocation: {
                  city: "New York",
                  stateOrProvince: "NY",
                  postalCode: "10007",
                  country: "US"
                },
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const response = await request(app)
      .post("/api/v1/marketplaces/ebay/search-by-location")
      .send({
        q: "Rolex Submariner",
        latitude: 40.7128,
        longitude: -74.006,
        limit: 5
      })
      .expect(200);
    const body = response.body as DataResponse<Array<{ externalId: string; location: string }>>;

    expect(body.data[0]).toMatchObject({
      externalId: "v1|loc|0",
      location: "New York, NY, 10007, US"
    });
    const ebaySearchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/item_summary/search") &&
      String(call[0]).includes("deliveryPostalCode")
    );
    expect((ebaySearchCall?.[0] as URL).href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=Rolex+Submariner&limit=5&filter=deliveryPostalCode%3A10007%2CdeliveryCountry%3AUS"
    );
    expect(ebaySearchCall?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "X-EBAY-C-ENDUSERCTX": "contextualLocation=country=US,zip=10007"
      })
    });
  });

  it("searches eBay by coordinates only with a default watch query", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.includes("nominatim.openstreetmap.org/reverse")) {
        return new Response(
          JSON.stringify({
            address: {
              postcode: "90012",
              country_code: "us"
            }
          }),
          { status: 200 }
        );
      }
      if (url.includes("/identity/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        });
      }
      if (url.includes("/buy/browse/v1/item_summary/search")) {
        return new Response(JSON.stringify({ total: 0, itemSummaries: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const response = await request(app)
      .post("/api/v1/marketplaces/ebay/search-by-location")
      .send({
        lat: 34.0522,
        lan: -118.2437
      })
      .expect(200);
    await request(app)
      .post("/api/v1/marketplaces/ebay/search-by-location")
      .send({
        lat: 34.0522,
        lan: -118.2437
      })
      .expect(200);
    const body = response.body as DataResponse<unknown[]>;
    expect(body.data).toEqual([]);
    const reverseGeocodeCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("nominatim.openstreetmap.org/reverse")
    );
    expect(reverseGeocodeCalls).toHaveLength(1);
    const ebaySearchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/item_summary/search") &&
      String(call[0]).includes("deliveryPostalCode")
    );
    expect((ebaySearchCall?.[0] as URL).searchParams.get("q")).toBe("watch");
    expect((ebaySearchCall?.[0] as URL).searchParams.get("limit")).toBe("10");
  });

  it("saves products, saves searches, and reads recommendation records", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const savedProductResponse = await request(app)
      .post("/api/v1/saved-products")
      .set("Authorization", authorization)
      .send({
        source: "ebay",
        id: "v1|saved|0",
        image: "https://i.ebayimg.test/saved.jpg",
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        price: 12500,
        currency: "USD",
        region: "United States"
      })
      .expect(201);
    const savedProduct = savedProductResponse.body as RecordResponse;
    expect(savedProduct.data.data).toMatchObject({
      source: "ebay",
      id: "v1|saved|0",
      productId: "v1|saved|0",
      image: "https://i.ebayimg.test/saved.jpg",
      title: "Rolex Submariner 126610LN",
      region: "United States"
    });

    const savedProductsResponse = await request(app)
      .get("/api/v1/saved-products")
      .set("Authorization", authorization)
      .expect(200);
    const savedProducts = savedProductsResponse.body as DataResponse<unknown[]>;
    expect(savedProducts.data).toHaveLength(1);

    const savedSearchResponse = await request(app)
      .post("/api/v1/saved-searches")
      .set("Authorization", authorization)
      .send({
        query: "Rolex Submariner",
        filters: { brand: "Rolex", model: "Submariner" }
      })
      .expect(201);
    const savedSearch = savedSearchResponse.body as RecordResponse;
    expect(savedSearch.data.data).toMatchObject({
      query: "Rolex Submariner",
      filters: { brand: "Rolex", model: "Submariner" }
    });

    const savedSearchesResponse = await request(app)
      .get("/api/v1/saved-searches")
      .set("Authorization", authorization)
      .expect(200);
    const savedSearches = savedSearchesResponse.body as DataResponse<unknown[]>;
    expect(savedSearches.data).toHaveLength(1);

    const recommendationsResponse = await request(app)
      .get("/api/v1/recommended-products")
      .set("Authorization", authorization)
      .expect(200);
    const recommendations = recommendationsResponse.body as DataResponse<{ items: unknown[]; local: unknown[]; ebay: unknown[]; status: string }>;
    expect(recommendations.data).toMatchObject({
      status: "pending",
      items: [],
      local: [],
      ebay: []
    });
  });

  it("creates subscription checkout and billing portal sessions", async () => {
    process.env.STRIPE_ELITE_PRICE_ID = "price_elite_collector";
    resetEnvForTests();

    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const plansResponse = await request(app)
      .get("/api/v1/subscription/plans")
      .set("Authorization", authorization)
      .expect(200);
    const plans = plansResponse.body as DataResponse<{ plans: Array<{ id: string; price: number }> }>;
    expect(plans.data.plans).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "standard", price: 0 }),
      expect.objectContaining({ id: "elite_collector", price: 29.99 })
    ]));

    const checkoutResponse = await request(app)
      .post("/api/v1/subscription/checkout")
      .set("Authorization", authorization)
      .send({
        successUrl: "https://mywatchbox.net/subscription/success",
        cancelUrl: "https://mywatchbox.net/subscription/cancel"
      })
      .expect(201);
    const checkout = checkoutResponse.body as DataResponse<{ checkoutSessionId: string; url: string }>;
    expect(checkout.data.checkoutSessionId).toContain("local_");
    expect(checkout.data.url).toBe("https://mywatchbox.net/subscription/success");

    const statusResponse = await request(app)
      .get("/api/v1/subscription")
      .set("Authorization", authorization)
      .expect(200);
    const status = statusResponse.body as DataResponse<{ plan: string; stripeCustomerId: string }>;
    expect(status.data).toMatchObject({
      plan: "standard",
      stripeCustomerId: expect.stringContaining("local_customer_")
    });

    const portalResponse = await request(app)
      .post("/api/v1/subscription/portal")
      .set("Authorization", authorization)
      .send({ returnUrl: "https://mywatchbox.net/account/subscription" })
      .expect(200);
    const portal = portalResponse.body as DataResponse<{ url: string }>;
    expect(portal.data.url).toBe("https://mywatchbox.net/account/subscription");
  });

  it("accepts signed Stripe subscription webhooks and upgrades the customer plan", async () => {
    const webhookSecret = "whsec_test_secret";
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
    resetEnvForTests();

    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    const account = await CustomerAccountModel.findOne({ email: "generated-customer@example.com" });
    expect(account).toBeTruthy();

    const payload = {
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          customer: "cus_test",
          subscription: "sub_test",
          client_reference_id: account?._id.toString(),
          metadata: {
            userId: account?._id.toString(),
            plan: "elite_collector"
          }
        }
      }
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    await request(app)
      .post("/api/v1/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", `t=${timestamp},v1=${signature}`)
      .send(rawBody)
      .expect(200);

    const statusResponse = await request(app)
      .get("/api/v1/subscription")
      .set("Authorization", authorization)
      .expect(200);
    const status = statusResponse.body as DataResponse<{
      plan: string;
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    }>;
    expect(status.data).toMatchObject({
      plan: "elite_collector",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test"
    });
  });

  it("creates recommended products in the background after a search", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner 126610LN",
        brand: "Rolex",
        model: "Submariner",
        price: 12500,
        currency: "USD",
        condition: "excellent"
      })
      .expect(201);

    const searchResponse = await request(app)
      .post("/api/v1/ai/search")
      .set("Authorization", authorization)
      .field("keyword", "Rolex Submariner")
      .expect(201);
    const searchBody = searchResponse.body as DataResponse<{ searchId: string }>;

    let recommendationBody: DataResponse<{ searchId?: string; items?: Array<Record<string, unknown>>; local?: unknown[]; ebay?: unknown[] }> | undefined;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app)
        .get("/api/v1/recommended-products")
        .set("Authorization", authorization)
        .expect(200);
      recommendationBody = response.body as DataResponse<{ searchId?: string; items?: Array<Record<string, unknown>>; local?: unknown[]; ebay?: unknown[] }>;
      if (recommendationBody.data.searchId === searchBody.data.searchId) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(recommendationBody?.data.searchId).toBe(searchBody.data.searchId);
    expect(recommendationBody?.data.items).toEqual(expect.any(Array));
    if (recommendationBody?.data.items?.[0]) {
      expect(recommendationBody.data.items[0]).not.toHaveProperty("similarProducts");
    }
    expect(recommendationBody?.data.local).toEqual(expect.any(Array));
    expect(recommendationBody?.data.ebay).toEqual(expect.any(Array));
  });

  it("creates watch alerts and stores automatic alert events with product details", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({
        title: "Rolex Submariner Alert Watch",
        brand: "Rolex",
        price: 12000,
        currency: "USD",
        region: "United States"
      })
      .expect(201);

    const alertResponse = await request(app)
      .post("/api/v1/watch-alerts")
      .set("Authorization", authorization)
      .send({
        query: "Rolex Submariner Alert",
        source: "local",
        eventTypes: ["new_watch", "price_drop", "search_update"],
        minDropPercentage: 5
      })
      .expect(201);
    const alert = alertResponse.body as RecordResponse;
    expect(alert.data.data).toMatchObject({
      query: "Rolex Submariner Alert",
      source: "local"
    });

    const runResponse = await request(app)
      .post("/api/v1/watch-alerts/run")
      .set("Authorization", authorization)
      .expect(200);
    const run = runResponse.body as DataResponse<{ checked: number; eventsCreated: number }>;
    expect(run.data.checked).toBe(1);
    expect(run.data.eventsCreated).toBeGreaterThan(0);

    const eventsResponse = await request(app)
      .get("/api/v1/watch-alert-events")
      .set("Authorization", authorization)
      .expect(200);
    const events = eventsResponse.body as DataResponse<Array<{
      data: {
        type: string;
        alert: { type: string; query: string };
        product: { title: string; price: number };
        productDetails: { title: string; price: number; brand: string; region: string };
      }
    }>>;
    expect(events.data[0]?.data).toMatchObject({
      type: "new_watch",
      alert: {
        type: "new_watch",
        query: "Rolex Submariner Alert"
      },
      product: {
        title: "Rolex Submariner Alert Watch",
        price: 12000
      },
      productDetails: {
        title: "Rolex Submariner Alert Watch",
        price: 12000,
        brand: "Rolex",
        region: "United States"
      }
    });

    await request(app)
      .delete(`/api/v1/watch-alerts/${alert.data.id}`)
      .set("Authorization", authorization)
      .expect(200);
    const listAfterDeleteResponse = await request(app)
      .get("/api/v1/watch-alerts")
      .set("Authorization", authorization)
      .expect(200);
    const listAfterDelete = listAfterDeleteResponse.body as DataResponse<unknown[]>;
    expect(listAfterDelete.data).toHaveLength(0);
  });

  it("returns eBay product details from eBay item aspects by ID", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.includes("/identity/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        });
      }
      if (url.includes("/buy/browse/v1/item/")) {
        return new Response(
          JSON.stringify({
            itemId: "v1|987|0",
            title: "Rolex Submariner Date 126610LN",
            price: { value: "13250.00", currency: "USD" },
            itemWebUrl: "https://www.ebay.com/itm/987",
            image: { imageUrl: "https://i.ebayimg.test/987.jpg" },
            description: "Authentic Rolex Submariner Date with full set.",
            condition: "Pre-Owned",
            localizedAspects: [
              { name: "Brand", value: "Rolex" },
              { name: "Model", value: "Rolex Submariner" },
              { name: "Reference Number", value: "126610LN" },
              { name: "Movement", value: "Automatic" },
              { name: "Year Manufactured", value: "2022" },
              { name: "With Original Box/Packaging", value: "Yes" },
              { name: "With Papers", value: "Yes" }
            ],
            seller: { username: "watch-seller", feedbackScore: 2400, feedbackPercentage: "99.8" },
            buyingOptions: ["FIXED_PRICE"]
          }),
          { status: 200 }
        );
      }
      if (url.includes("/buy/browse/v1/item_summary/search")) {
        return new Response(
          JSON.stringify({
            total: 3,
            itemSummaries: [
              {
                itemId: "v1|654|0",
                title: "Rolex Submariner Date 126610LN Full Set",
                price: { value: "12900.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/654",
                image: { imageUrl: "https://i.ebayimg.test/654.jpg" },
                condition: "Pre-Owned",
                localizedAspects: [
                  { name: "Brand", value: "Rolex" },
                  { name: "Model", value: "Rolex Submariner" },
                  { name: "Reference Number", value: "126610LN" }
                ],
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const response = await request(app)
      .get("/api/v1/products/ebay/v1%7C987%7C0/details?marketplaceId=EBAY_US")
      .set("Authorization", authorization);
    expect(response.status).toBe(200);
    const body = response.body as DataResponse<{
      source: string;
      id: string;
      brand: string;
      model: string;
      referenceNumber: string;
      productionYear: number;
      movement: string;
      scope: string;
      image: string;
      sourceUrl: string;
      similarProducts: unknown[];
    }>;

    expect(body.data).toMatchObject({
      source: "ebay",
      id: "v1|987|0",
      brand: "Rolex",
      model: "Rolex Submariner",
      referenceNumber: "126610LN",
      productionYear: 2022,
      movement: "Automatic",
      scope: "full set",
      image: "https://i.ebayimg.test/987.jpg",
      sourceUrl: "https://www.ebay.com/itm/987"
    });
    expect(body.data.similarProducts).toHaveLength(5);
    const itemDetailCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/buy/browse/v1/item/v1%7C987%7C0"));
    expect(itemDetailCall).toBeDefined();
  });

  it("returns eBay market insights with searched, price-drop, and upward products", async () => {
    process.env.EBAY_CLIENT_ID = "client-id";
    process.env.EBAY_CLIENT_SECRET = "client-secret";
    process.env.EBAY_ENVIRONMENT = "sandbox";
    process.env.EBAY_MARKETPLACE_ID = "EBAY_US";
    resetEnvForTests();

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = input instanceof URL ? input.href : String(input);
      if (url.includes("/identity/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access-token", expires_in: 7200 }), {
          status: 200
        });
      }
      if (url.includes("/buy/browse/v1/item_summary/search")) {
        return new Response(
          JSON.stringify({
            total: 22,
            itemSummaries: [
              {
                itemId: "v1|drop|0",
                title: "Rolex Submariner 126610LN Price Drop",
                price: { value: "10000.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/drop",
                image: { imageUrl: "https://i.ebayimg.test/drop.jpg" },
                condition: "Pre-Owned",
                localizedAspects: [
                  { name: "Brand", value: "Rolex" },
                  { name: "Model", value: "Submariner" },
                  { name: "Reference Number", value: "126610LN" }
                ],
                buyingOptions: ["FIXED_PRICE"]
              },
              {
                itemId: "v1|up|0",
                title: "Rolex Submariner 126610LN Premium",
                price: { value: "1000000.00", currency: "USD" },
                itemWebUrl: "https://www.ebay.com/itm/up",
                image: { imageUrl: "https://i.ebayimg.test/up.jpg" },
                condition: "Pre-Owned",
                localizedAspects: [
                  { name: "Brand", value: "Rolex" },
                  { name: "Model", value: "Submariner" },
                  { name: "Reference Number", value: "126610LN" }
                ],
                buyingOptions: ["FIXED_PRICE"]
              }
            ]
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const response = await request(app)
      .get("/api/v1/marketplaces/ebay/market-insights?q=Rolex%20Submariner&sampleLimit=10")
      .expect(200);
    const body = response.body as DataResponse<{
      mostSearchedProduct: { brand: string; referenceNumber: string; price: number };
      biggestPriceDropProduct: { externalId: string; upDownPercentage: number; direction: string };
      trendingUpwardProduct: { externalId: string; upDownPercentage: number; direction: string };
    }>;

    expect(body.data.mostSearchedProduct).toMatchObject({
      brand: "Rolex",
      referenceNumber: "126610LN",
      price: 10000
    });
    expect(body.data.biggestPriceDropProduct).toMatchObject({
      externalId: "v1|drop|0",
      upDownPercentage: -98.02,
      direction: "down"
    });
    expect(body.data.trendingUpwardProduct).toMatchObject({
      externalId: "v1|up|0",
      upDownPercentage: 98.02,
      direction: "up"
    });
    expect(body.data.biggestPriceDropProduct.upDownPercentage).toBeGreaterThanOrEqual(-100);
    expect(body.data.trendingUpwardProduct.upDownPercentage).toBeLessThanOrEqual(100);
  });

  it("creates, reads, and updates content pages with inline image links", async () => {
    const adminToken = await loginAdmin();
    const authorization = `Bearer ${adminToken}`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    );

    const inlineImageResponse = await request(app)
      .post("/api/v1/admin/settings/content/images")
      .set("Authorization", authorization)
      .attach("file", png, {
        filename: "quill-image.png",
        contentType: "image/png"
      })
      .expect(201);
    const inlineImage = inlineImageResponse.body as DataResponse<{ image: string }>;
    expect(Object.keys(inlineImage.data)).toEqual(["image"]);
    expect(inlineImage.data.image).toContain("content-pages/inline/");

    const content = `<p>We connect collectors with trusted watch listings.</p><p><img src="${inlineImage.data.image}"></p>`;
    const createdResponse = await request(app)
      .post("/api/v1/admin/settings/content/pages/about-us")
      .set("Authorization", authorization)
      .send({
        title: "About WatchBox",
        content,
        summary: "About our marketplace"
      })
      .expect(201);
    const created = createdResponse.body as RecordResponse;
    expect(created.data.data).toMatchObject({
      slug: "about",
      title: "About WatchBox",
      content,
      summary: "About our marketplace",
      image: null
    });

    const publicResponse = await request(app).get("/api/v1/content/about").expect(200);
    const publicPage = publicResponse.body as RecordResponse;
    expect(publicPage.data.data).toMatchObject({
      slug: "about",
      title: "About WatchBox",
      content
    });

    const updatedContent = `<p>Updated about us content.</p><p><img src="${inlineImage.data.image}"></p>`;
    const updatedResponse = await request(app)
      .patch("/api/v1/admin/settings/content/pages/about")
      .set("Authorization", authorization)
      .send({
        content: updatedContent
      })
      .expect(200);
    const updated = updatedResponse.body as RecordResponse;
    expect(updated.data.data.content).toBe(updatedContent);
    expect(updated.data.data.image).toBeNull();

    const listResponse = await request(app)
      .get("/api/v1/admin/settings/content/pages")
      .set("Authorization", authorization)
      .expect(200);
    const list = listResponse.body as DataResponse<Array<{ data: Record<string, unknown> }>>;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.data.slug).toBe("about");
  });

  it("enforces admin auth and permissions on generated admin APIs", async () => {
    await request(app).get("/api/v1/admin/dashboard/summary").expect(401);

    const accessToken = await loginAdmin();
    const response = await request(app)
      .get("/api/v1/admin/dashboard/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const body = response.body as DataResponse<unknown[]>;
    expect(body.data).toEqual([]);
  });

  it("accepts signed webhook events and stores them", async () => {
    const payload = { id: "evt_test", type: "email.delivered" };
    const signature = createHmac("sha256", getEnv().ENCRYPTION_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    const response = await request(app)
      .post("/api/v1/webhooks/email")
      .set("x-watchbox-signature", signature)
      .send(payload)
      .expect(201);
    const body = response.body as RecordResponse;
    expect(body.data.data.id).toBe("evt_test");
  });
});
