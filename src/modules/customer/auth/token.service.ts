import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { getAuthConfig } from "../../../config/auth.config.js";

export type TokenAudience = "customer" | "admin";

export type TokenPayload = {
  subject: string;
  audience: TokenAudience;
  sessionId: string;
};

export type VerifiedToken = TokenPayload & {
  tokenId?: string;
};

export class TokenService {
  public signAccessToken(payload: TokenPayload): string {
    const config = getAuthConfig();
    const secret =
      payload.audience === "customer" ? config.customerAccessSecret : config.adminAccessSecret;
    const expiresIn = config.accessTtl as NonNullable<SignOptions["expiresIn"]>;
    const options: SignOptions = {
      subject: payload.subject,
      audience: payload.audience,
      expiresIn
    };
    return jwt.sign({ sessionId: payload.sessionId }, secret, {
      ...options
    });
  }

  public signRefreshToken(payload: TokenPayload): string {
    const config = getAuthConfig();
    const secret =
      payload.audience === "customer" ? config.customerRefreshSecret : config.adminRefreshSecret;
    const expiresIn = config.refreshTtl as NonNullable<SignOptions["expiresIn"]>;
    const options: SignOptions = {
      jwtid: randomUUID(),
      subject: payload.subject,
      audience: payload.audience,
      expiresIn
    };
    return jwt.sign({ sessionId: payload.sessionId }, secret, options);
  }

  public verifyAccessToken(token: string, audience: TokenAudience): VerifiedToken {
    return this.verifyToken(token, audience, "access");
  }

  public verifyRefreshToken(token: string, audience: TokenAudience): VerifiedToken {
    return this.verifyToken(token, audience, "refresh");
  }

  public hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  public createOpaqueToken(): string {
    return randomBytes(32).toString("hex");
  }

  public hashOpaqueToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private verifyToken(
    token: string,
    audience: TokenAudience,
    type: "access" | "refresh"
  ): VerifiedToken {
    const config = getAuthConfig();
    const secret =
      audience === "customer"
        ? type === "access"
          ? config.customerAccessSecret
          : config.customerRefreshSecret
        : type === "access"
          ? config.adminAccessSecret
          : config.adminRefreshSecret;

    const decoded = jwt.verify(token, secret, { audience });
    if (typeof decoded !== "object" || !decoded.sub || typeof decoded.sessionId !== "string") {
      throw new AuthenticationError("Invalid authentication token.");
    }

    const result: VerifiedToken = {
      subject: decoded.sub,
      audience,
      sessionId: decoded.sessionId
    };
    if (typeof decoded.jti === "string") {
      result.tokenId = decoded.jti;
    }
    return result;
  }
}
