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

    const fetchMock = vi.spyOn(globalThis, "fetch")
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
        )
      );

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
        similarProducts: unknown[];
      }>
    >;

    const searchUrl = fetchMock.mock.calls
      .map((call) => call[0])
      .find((value): value is URL => value instanceof URL && value.pathname.includes("/item_summary/search"));
    expect(searchUrl?.href).toBe(
      "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=Rolex+Submariner+126610LN&limit=20"
    );
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
      similarProducts: expect.any(Array)
    });
    expect(body.data[0]?.similarProducts).toHaveLength(5);
    expect(body.data[0]?.similarityScore).toBeGreaterThan(0);
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
