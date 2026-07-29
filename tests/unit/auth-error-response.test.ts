import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getAuthConfig } from "../../src/config/auth.config.js";

describe("auth error responses", () => {
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
});
