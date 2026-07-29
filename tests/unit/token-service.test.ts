import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../src/common/errors/app-error.js";
import { getAuthConfig } from "../../src/config/auth.config.js";
import { TokenService } from "../../src/modules/customer/auth/token.service.js";

describe("TokenService", () => {
  it("returns a clear authentication error for expired access tokens", () => {
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

    expect(() => new TokenService().verifyAccessToken(expiredToken, "customer")).toThrow(
      new AuthenticationError("Your session has expired. Please log in again.")
    );
  });
});
