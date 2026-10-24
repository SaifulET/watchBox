import { describe, expect, it } from "vitest";
import { normalizeContentSlug } from "../../src/modules/customer/content/content.validation.js";
import {
  publicAccountDeletionSchema,
  publicContactSchema
} from "../../src/modules/public-pages/public-pages.validation.js";

describe("public content slugs", () => {
  it("accepts legal and account-deletion aliases", () => {
    expect(normalizeContentSlug("privacy-policy")).toBe("privacy-policy");
    expect(normalizeContentSlug("terms-and-conditions")).toBe("terms");
    expect(normalizeContentSlug("delete-account")).toBe("account-deletion");
    expect(normalizeContentSlug("account-deletion-method")).toBe("account-deletion");
  });
});

describe("public page payloads", () => {
  it("accepts a contact form submission", () => {
    const parsed = publicContactSchema.parse({
      name: "Alex Collector",
      email: "Customer@Example.com",
      subject: "Listing help",
      message: "I need help updating my watch photos."
    });

    expect(parsed.email).toBe("customer@example.com");
    expect(parsed.subject).toBe("Listing help");
  });

  it("requires DELETE confirmation for account deletion", () => {
    const parsed = publicAccountDeletionSchema.parse({
      email: "customer@example.com",
      password: "customer-password",
      confirmation: "delete"
    });

    expect(parsed.confirmation).toBe("DELETE");
    expect(() =>
      publicAccountDeletionSchema.parse({
        email: "customer@example.com",
        password: "customer-password",
        confirmation: "remove"
      })
    ).toThrow();
  });
});
