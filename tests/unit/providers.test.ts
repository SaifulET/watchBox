import { describe, expect, it } from "vitest";
import { LocalAiProvider } from "../../src/infrastructure/external/ai/ai-provider.js";
import { LocalEmailProvider } from "../../src/infrastructure/external/email/email-provider.js";
import { LocalPaymentProvider } from "../../src/infrastructure/external/stripe/stripe-provider.js";

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
    const provider = new LocalEmailProvider();
    const result = await provider.send({
      to: "buyer@example.test",
      subject: "Welcome",
      html: "<p>Welcome</p>"
    });

    expect(result.providerMessageId).toContain("local-email");
  });
});
