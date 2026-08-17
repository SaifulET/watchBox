import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { getDatabaseConfig } from "../../src/config/database.config.js";
import { resetEnvForTests } from "../../src/config/env.js";
import { Chrono24ListingModel } from "../../src/modules/marketplaces/chrono24/models/chrono24-listing.model.js";
import { Chrono24PriceSnapshotModel } from "../../src/modules/marketplaces/chrono24/models/chrono24-price-snapshot.model.js";
import { Chrono24SearchStatModel } from "../../src/modules/marketplaces/chrono24/models/chrono24-search-stat.model.js";

process.env.SCRAPINGBEE_API_KEY = "scrapingbee-key";
process.env.CHRONO24_BASE_URL = "https://www.chrono24.com";
process.env.CHRONO24_COUNTRY_CODE = "us";
process.env.CHRONO24_RENDER_JS = "true";
process.env.CHRONO24_STEALTH_PROXY = "true";
process.env.CHRONO24_BLOCK_RESOURCES = "false";
resetEnvForTests();

const app = createApp();
let mongoAvailable = false;

type DataResponse<TData> = {
  success: true;
  data: TData;
};

const html = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Omega Speedmaster Professional",
  "brand": {"@type": "Brand", "name": "Omega"},
  "model": "Speedmaster",
  "mpn": "310.30.42.50.01.002",
  "image": "https://cdn.example.test/speedmaster.jpg",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "6500",
    "highPrice": "7200",
    "offerCount": 1,
    "priceCurrency": "USD",
    "offers": [{
      "@type": "Offer",
      "url": "https://www.chrono24.com/omega/speedmaster--id987654.htm",
      "price": "6800",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "itemCondition": "Very good"
    }]
  }
}
</script>`;

const connectForTests = async (): Promise<void> => {
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: `${config.databaseName}-test`,
    autoIndex: true,
    serverSelectionTimeoutMS: 2_000
  });
  mongoAvailable = true;
};

describe.sequential("Chrono24 marketplace routes", () => {
  beforeAll(async () => {
    try {
      await connectForTests();
    } catch {
      mongoAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!mongoAvailable) {
      return;
    }
    await Promise.all([
      Chrono24ListingModel.deleteMany({}),
      Chrono24PriceSnapshotModel.deleteMany({}),
      Chrono24SearchStatModel.deleteMany({})
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (mongoAvailable) {
      await mongoose.disconnect();
    }
  });

  it("searches Chrono24 through ScrapingBee and persists listings with snapshots", async (context) => {
    if (!mongoAvailable) {
      context.skip();
      return;
    }
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(html, { status: 200 }));

    const response = await request(app)
      .get("/api/v1/marketplaces/chrono24/search")
      .query({ q: "Omega Speedmaster", limit: 10 })
      .expect(200);
    const body = response.body as DataResponse<{
      count: number;
      items: Array<{ id: string; source: string; title: string; price: number; currency: string }>;
    }>;

    expect(body.data.count).toBe(1);
    expect(body.data.items[0]).toMatchObject({
      id: "987654",
      source: "chrono24",
      title: "Omega Speedmaster Professional",
      price: 6800,
      currency: "USD"
    });
    await expect(Chrono24ListingModel.countDocuments({ listingId: "987654" })).resolves.toBe(1);
    await expect(Chrono24PriceSnapshotModel.countDocuments({ listingId: "987654" })).resolves.toBe(1);
    await expect(Chrono24SearchStatModel.countDocuments({ normalizedQuery: "omega speedmaster" })).resolves.toBe(1);
  });
});
