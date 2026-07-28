import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../src/app.js";

const readinessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal("degraded"),
    checks: z.array(
      z.object({
        name: z.string(),
        ok: z.boolean()
      })
    )
  })
});

describe("readiness route", () => {
  it("uses the standard response shape when dependencies are unavailable", async () => {
    const app = createApp();
    const response = await request(app).get("/health/ready").expect(503);
    const body = readinessResponseSchema.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.data.status).toBe("degraded");
    expect(body.data.checks[0]?.name).toBe("mongodb");
  });
});
