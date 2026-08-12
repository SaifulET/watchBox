import { describe, expect, it } from "vitest";
import { Chrono24Provider } from "../../src/infrastructure/external/chrono24/chrono24-provider.js";

describe("Chrono24Provider", () => {
  it("has correct marketplace code", () => {
    const provider = new Chrono24Provider();
    expect(provider.code).toBe("CHRONO24");
  });

  it("parses fallback Chrono24 items cleanly when HTML contains Chrono24", async () => {
    const provider = new Chrono24Provider();
    // @ts-expect-error testing private parser
    const listings = provider.parseChrono24Html("<html><body>Chrono24 Watch Listing</body></html>", "https://www.chrono24.com", 5);
    expect(listings.length).toBeGreaterThan(0);
    expect(listings[0]).toHaveProperty("title");
    expect(listings[0]).toHaveProperty("sourceUrl");
    expect(listings[0]?.sourceUrl).toContain("chrono24.com");
    expect(listings[0]?.price).toBeGreaterThan(0);
    expect(listings[0]?.currency).toBe("USD");
  });

  it("extracts listings from sample article HTML blocks", async () => {
    const provider = new Chrono24Provider();
    const sampleHtml = `
      <article>
        <a href="/rolex/submariner--id123456.htm">
          <div class="article-title">Rolex Submariner 126610LN</div>
          <div class="article-price">$14,500</div>
          <img src="https://s.c24.media/images/rolex-1.jpg" />
          <div class="location">United States</div>
        </a>
      </article>
    `;
    // @ts-expect-error testing private parser
    const listings = provider.parseChrono24Html(sampleHtml, "https://www.chrono24.com", 10);
    expect(listings.length).toBe(1);
    expect(listings[0]?.externalId).toBe("123456");
    expect(listings[0]?.title).toBe("Rolex Submariner 126610LN");
    expect(listings[0]?.brand).toBe("Rolex");
    expect(listings[0]?.model).toBe("Submariner 126610LN");
    expect(listings[0]?.price).toBe(14500);
    expect(listings[0]?.currency).toBe("USD");
    expect(listings[0]?.sourceUrl).toBe("https://www.chrono24.com/rolex/submariner--id123456.htm");
  });
});
