import { describe, expect, it } from "vitest";
import request from "supertest";
import { z } from "zod";
import { createApp } from "../../src/app.js";

const healthResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal("ok"),
    uptimeSeconds: z.number()
  }),
  meta: z.object({
    requestId: z.string()
  })
});

describe("health routes", () => {
  it("returns root health", async () => {
    const app = createApp();
    const response = await request(app).get("/health").expect(200);
    const body = healthResponseSchema.parse(response.body);

    expect(body).toMatchObject({
      success: true,
      data: { status: "ok" }
    });
  });

  it("returns liveness", async () => {
    const app = createApp();
    const response = await request(app).get("/health/live").expect(200);
    const body = healthResponseSchema.parse(response.body);

    expect(body.data.status).toBe("ok");
    expect(body.meta.requestId).toBeDefined();
  });
});
