import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../src/common/errors/app-error.js";
import {
  extractRevenueCatEvent,
  mapRevenueCatEvent,
  revenueCatUserCandidates,
  verifyRevenueCatAuthorization
} from "../../src/modules/customer/subscriptions/revenuecat-webhook.js";

describe("RevenueCat webhook mapping", () => {
  it("reads the nested event payload", () => {
    const event = extractRevenueCatEvent({
      api_version: "1.0",
      event: {
        id: "evt_1",
        type: "INITIAL_PURCHASE",
        app_user_id: "64f000000000000000000001",
        product_id: "elite_monthly"
      }
    });
    expect(event).toMatchObject({
      id: "evt_1",
      type: "INITIAL_PURCHASE",
      app_user_id: "64f000000000000000000001",
      product_id: "elite_monthly"
    });
  });

  it("activates Elite on initial purchase", () => {
    const mapped = mapRevenueCatEvent({
      type: "INITIAL_PURCHASE",
      product_id: "elite_monthly",
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000
    });
    expect(mapped).toMatchObject({
      plan: "elite_collector",
      status: "active",
      cancelAtPeriodEnd: false
    });
  });

  it("keeps Elite after cancellation until expiration", () => {
    const mapped = mapRevenueCatEvent({
      type: "CANCELLATION",
      expiration_at_ms: Date.now() + 7 * 24 * 60 * 60 * 1000
    });
    expect(mapped).toMatchObject({
      plan: "elite_collector",
      status: "active",
      cancelAtPeriodEnd: true
    });
  });

  it("returns Standard on expiration", () => {
    const mapped = mapRevenueCatEvent({
      type: "EXPIRATION",
      expiration_at_ms: Date.now() - 1000
    });
    expect(mapped).toMatchObject({
      plan: "standard",
      status: "expired"
    });
  });

  it("marks billing issues as past due", () => {
    expect(mapRevenueCatEvent({ type: "BILLING_ISSUE" }).status).toBe("past_due");
  });

  it("collects RevenueCat user ids and email", () => {
    expect(
      revenueCatUserCandidates({
        type: "RENEWAL",
        app_user_id: "user-1",
        original_app_user_id: "user-1",
        aliases: ["alias-2"],
        subscriber_attributes: { $email: { value: "buyer@example.com" } }
      })
    ).toEqual(["user-1", "alias-2", "buyer@example.com"]);
  });

  it("rejects a missing authorization in production", () => {
    expect(() => verifyRevenueCatAuthorization(undefined, "rc_secret", "production")).toThrow(
      AuthenticationError
    );
    expect(() => verifyRevenueCatAuthorization("Bearer rc_secret", "rc_secret", "production")).not.toThrow();
  });
});
