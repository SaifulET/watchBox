import { describe, expect, it } from "vitest";
import {
  blockUserBodySchema,
  reportStatusBodySchema,
  reportUserBodySchema
} from "../../src/modules/moderation/moderation.validation.js";

const userId = "64f000000000000000000002";
const listingId = "64f000000000000000000001";

describe("block payloads", () => {
  it("requires a valid user id", () => {
    expect(blockUserBodySchema.parse({ userId }).userId).toBe(userId);
    expect(() => blockUserBodySchema.parse({ userId: "bad" })).toThrow();
  });
});

describe("report payloads", () => {
  it("accepts a user report with a reason", () => {
    const parsed = reportUserBodySchema.parse({
      userId,
      reason: "unprofessional",
      message: "Rude messages in chat."
    });
    expect(parsed.reason).toBe("unprofessional");
  });

  it("accepts a listing report", () => {
    const parsed = reportUserBodySchema.parse({
      listingId,
      reason: "fake-listing"
    });
    expect(parsed.listingId).toBe(listingId);
  });

  it("requires a target", () => {
    expect(() => reportUserBodySchema.parse({ reason: "spam" })).toThrow();
  });

  it("accepts admin status changes", () => {
    expect(reportStatusBodySchema.parse({ status: "resolved" }).status).toBe("resolved");
    expect(reportStatusBodySchema.parse({ status: "pending" }).status).toBe("pending");
  });
});
