import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getAuthConfig } from "../../src/config/auth.config.js";
import { parseEbayOAuthCallbackQuery } from "../../src/modules/customer/ebay/ebay.validation.js";

describe("auth error responses", () => {
  it("returns a clear response for malformed JSON bodies", async () => {
    const response = await request(createApp())
      .post("/api/v1/ai/search")
      .set("Content-Type", "application/json")
      .send('{\r\n  "q": "Rolex",\r\n \r\n}')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON."
      }
    });
  });

  it("returns a clear response for expired bearer tokens", async () => {
    const config = getAuthConfig();
    const expiredToken = jwt.sign(
      { sessionId: "64f000000000000000000002" },
      config.customerAccessSecret,
      {
        subject: "64f000000000000000000001",
        audience: "customer",
        expiresIn: "-1s"
      }
    );

    const response = await request(createApp())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${expiredToken}`)
      .expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Your session has expired. Please log in again."
      }
    });
  });

  it("returns validation errors from manually parsed route queries as 400 responses", async () => {
    const response = await request(createApp())
      .get("/api/v1/ebay/oauth/callback?code=authorization-code")
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: [
          {
            path: "state",
            message: "Required"
          }
        ]
      }
    });
  });

  it("accepts a bare eBay OAuth state query key from manual callback testing", () => {
    const query = parseEbayOAuthCallbackQuery({
      "encoded-state.signature": "",
      code: "authorization-code",
      expires_in: "299"
    });

    expect(query).toEqual({
      state: "encoded-state.signature",
      code: "authorization-code",
      expires_in: "299"
    });
  });
});
