import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { getAuthConfig } from "../../../config/auth.config.js";

export type TokenAudience = "customer" | "admin";

export type TokenPayload = {
  subject: string;
  audience: TokenAudience;
  sessionId: string;
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
}
