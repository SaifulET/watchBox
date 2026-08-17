import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "../../src/config/env.js";
import { Chrono24Parser } from "../../src/modules/marketplaces/chrono24/chrono24.parser.js";
import { Chrono24ScrapingService } from "../../src/modules/marketplaces/chrono24/chrono24.scraper.js";
import {
  chrono24LocationSearchSchema,
  chrono24SearchBodySchema,
  chrono24SearchQuerySchema
} from "../../src/modules/marketplaces/chrono24/chrono24.validation.js";

const configureChrono24 = (): void => {
  process.env.SCRAPINGBEE_API_KEY = "scrapingbee-key";
  process.env.CHRONO24_BASE_URL = "https://www.chrono24.com";
  process.env.CHRONO24_COUNTRY_CODE = "us";
  process.env.CHRONO24_RENDER_JS = "true";
  process.env.CHRONO24_STEALTH_PROXY = "true";
  process.env.CHRONO24_BLOCK_RESOURCES = "false";
  resetEnvForTests();
};

const html = `
<html>
  <head>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": "Rolex Submariner Date 126610LN",
        "brand": {"@type": "Brand", "name": "Rolex"},
        "model": "Submariner",
        "mpn": "126610LN",
        "image": ["https://cdn.example.test/sub.jpg"],
        "description": "Public listing description.",
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "12000",
          "highPrice": "14000",
          "offerCount": "2",
          "priceCurrency": "USD",
          "offers": [
            {
              "@type": "Offer",
              "url": "/rolex/submariner--id123456.htm",
              "price": "12500",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock",
              "itemCondition": "Pre-owned"
            }
          ]
        }
      }
    </script>
  </head>
</html>`;

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SCRAPINGBEE_API_KEY;
  delete process.env.CHRONO24_BASE_URL;
  delete process.env.CHRONO24_COUNTRY_CODE;
  delete process.env.CHRONO24_RENDER_JS;
  delete process.env.CHRONO24_STEALTH_PROXY;
  delete process.env.CHRONO24_BLOCK_RESOURCES;
  resetEnvForTests();
});

describe("Chrono24 parser", () => {
  it("extracts products and AggregateOffer data from JSON-LD", () => {
    const parsed = new Chrono24Parser().parse(html, "https://www.chrono24.com");

    expect(parsed.aggregateOffer).toMatchObject({
      lowPrice: 12000,
      highPrice: 14000,
      offerCount: 2,
      priceCurrency: "USD"
    });
    expect(parsed.products[0]).toMatchObject({
      id: "123456",
      source: "chrono24",
      title: "Rolex Submariner Date 126610LN",
      brand: "Rolex",
      model: "Submariner",
      reference: "126610LN",
      price: 12500,
      currency: "USD",
      condition: "Pre-owned",
      image: "https://cdn.example.test/sub.jpg",
      url: "https://www.chrono24.com/rolex/submariner--id123456.htm"
    });
  });

  it("extracts JSON-LD that is encoded as a JSON string", () => {
    const encoded = JSON.stringify(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Tudor Black Bay",
        brand: { "@type": "Brand", name: "Tudor" },
        model: "Black Bay",
        mpn: "M7941A1A0RU-0003",
        image: "https://cdn.example.test/tudor.jpg",
        offers: {
          "@type": "Offer",
          url: "/tudor/black-bay--id333444.htm",
          price: "4200",
          priceCurrency: "USD"
        }
      })
    );

    const parsed = new Chrono24Parser().parse(
      `<script type="application/ld+json">${encoded}</script>`,
      "https://www.chrono24.com"
    );

    expect(parsed.products[0]).toMatchObject({
      id: "333444",
      title: "Tudor Black Bay",
      brand: "Tudor",
      price: 4200
    });
  });

  it("falls back to Chrono24 listing-card HTML when structured data is unusable", () => {
    const parsed = new Chrono24Parser().parse(
      `
      <script type="application/ld+json">{bad json</script>
      <article>
        <a href="/omega/speedmaster-professional--id987654.htm" title="Omega Speedmaster Professional">
          <img src="https://cdn.example.test/speedmaster.webp">
          <span>$6,800</span>
        </a>
      </article>
      `,
      "https://www.chrono24.com"
    );

    expect(parsed.products[0]).toMatchObject({
      id: "987654",
      title: "Omega Speedmaster Professional",
      brand: "Omega",
      model: "Speedmaster Professional",
      price: 6800,
      currency: "USD",
      image: "https://cdn.example.test/speedmaster.webp",
      url: "https://www.chrono24.com/omega/speedmaster-professional--id987654.htm"
    });
    expect(parsed.warnings).toContain(
      "Used Chrono24 HTML listing-card fallback because structured product data was unavailable."
    );
  });

  it("uses URL-derived titles and avoids treating references as prices in fallback cards", () => {
    const parsed = new Chrono24Parser().parse(
      `
      <article>
        <a href="/rolex/rolex-124060--id47783331.htm" title="More information">
          <img src="https://cdn.example.test/124060.jpg">
          <span>Rolex Submariner 124060 41 mm</span>
          <span>$12,995</span>
        </a>
      </article>
      `,
      "https://www.chrono24.com"
    );

    expect(parsed.products[0]).toMatchObject({
      id: "47783331",
      title: "rolex 124060",
      brand: "Rolex",
      model: "",
      reference: "124060",
      price: 12995,
      currency: "USD"
    });
  });
});

describe("Chrono24 validation", () => {
  it("accepts eBay-style loose search query aliases", () => {
    const parsed = chrono24SearchQuerySchema.parse({
      query: "Rolex Submarine",
      limit: "12"
    });

    expect(parsed).toMatchObject({
      q: "Rolex Submarine",
      page: 1,
      limit: 12,
      refresh: false
    });
  });

  it("accepts loose location aliases like the eBay location search", () => {
    const parsed = chrono24LocationSearchSchema.parse({
      lat: "40.7128",
      lng: "-74.006",
      radiusKm: "10",
      keyword: "Rolex Submariner"
    });

    expect(parsed).toMatchObject({
      latitude: 40.7128,
      longitude: -74.006,
      radiusKm: 10,
      q: "Rolex Submariner"
    });
  });

  it("accepts the POST Chrono24 search body used by the frontend", () => {
    const parsed = chrono24SearchBodySchema.parse({
      lat: 40.7128,
      lng: -74.006,
      radiusKm: 10,
      keyword: "Rolex Submariner"
    });

    expect(parsed).toMatchObject({
      q: "Rolex Submariner",
      latitude: 40.7128,
      longitude: -74.006,
      radiusKm: 10,
      page: 1,
      limit: 24,
      includeItemDetails: true,
      includeMarketDetails: true
    });
  });
});

describe("Chrono24 ScrapingBee service", () => {
  it("calls ScrapingBee with configured rendering and proxy parameters", async () => {
    configureChrono24();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(html, { status: 200 }));

    const service = new Chrono24ScrapingService();
    const parsed = await service.fetchSearchPage({
      q: "Rolex Submariner",
      page: 1,
      limit: 24
    });

    expect(parsed.products).toHaveLength(1);
    const callUrl = fetchMock.mock.calls[0]?.[0];
    expect(callUrl).toBeInstanceOf(URL);
    expect((callUrl as URL).origin).toBe("https://app.scrapingbee.com");
    expect((callUrl as URL).searchParams.get("api_key")).toBeNull();
    expect((callUrl as URL).searchParams.get("render_js")).toBe("true");
    expect((callUrl as URL).searchParams.get("stealth_proxy")).toBe("true");
    expect((callUrl as URL).searchParams.get("country_code")).toBe("us");
    expect((callUrl as URL).searchParams.get("block_resources")).toBe("false");
    expect((callUrl as URL).searchParams.get("url")).toContain("query=Rolex+Submariner");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer scrapingbee-key"
      }
    });
  });

  it("falls back to ScrapingBee api_key query authentication when Bearer auth is rejected", async () => {
    configureChrono24();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(html, { status: 200 }));

    const service = new Chrono24ScrapingService();
    const parsed = await service.fetchSearchPage({
      q: "Rolex Submariner",
      page: 1,
      limit: 24
    });

    expect(parsed.products[0]?.id).toBe("123456");
    expect((fetchMock.mock.calls[0]?.[0] as URL).searchParams.get("api_key")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer scrapingbee-key"
      }
    });
    expect((fetchMock.mock.calls[1]?.[0] as URL).searchParams.get("api_key")).toBe("scrapingbee-key");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
    });
  });

  it("does not reject usable JSON-LD just because vendor text mentions Cloudflare", async () => {
    configureChrono24();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(`${html}<footer>Cloudflare analytics</footer>`, { status: 200 })
    );

    const service = new Chrono24ScrapingService();
    const parsed = await service.fetchSearchPage({
      q: "Rolex Submariner",
      page: 1,
      limit: 24
    });

    expect(parsed.products[0]?.id).toBe("123456");
  });

  it("rejects real browser challenge pages without JSON-LD", async () => {
    configureChrono24();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html><title>Attention Required</title><body>Checking your browser</body></html>", {
        status: 200
      })
    );

    const service = new Chrono24ScrapingService();
    await expect(service.fetchSearchPage({ q: "Rolex", page: 1, limit: 24 })).rejects.toMatchObject({
      message: "Chrono24 returned a bot challenge or block page."
    });
  });
});
