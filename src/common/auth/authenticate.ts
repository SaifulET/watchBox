import type { RequestHandler } from "express";
import { AuthenticationError, AuthorizationError } from "../errors/app-error.js";
import { TokenService, type TokenAudience } from "../../modules/customer/auth/token.service.js";
import {
  AdminAccountRepository,
  AuthSessionRepository,
  CustomerAccountRepository
} from "../../modules/customer/auth/auth.repository.js";

const bearerPrefix = "Bearer ";

export const authenticate = (audience: TokenAudience): RequestHandler => {
  const tokens = new TokenService();
  const sessions = new AuthSessionRepository();
  const customers = new CustomerAccountRepository();
  const admins = new AdminAccountRepository();

  return (req, _res, next) => {
    void (async () => {
      const header = req.header("authorization");
      if (!header?.startsWith(bearerPrefix)) {
        throw new AuthenticationError();
      }

      const token = header.slice(bearerPrefix.length);
      const verified = tokens.verifyAccessToken(token, audience);
      const session = await sessions.findActiveById(verified.sessionId, audience);
      if (!session || session.accountId.toString() !== verified.subject) {
        throw new AuthenticationError("The session is no longer active.");
      }

      const account =
        audience === "customer"
          ? await customers.findById(verified.subject)
          : await admins.findById(verified.subject);
      if (!account || account.status !== "active") {
        throw new AuthenticationError("The account is no longer active.");
      }

      req.auth = {
        id: verified.subject,
        audience,
        sessionId: verified.sessionId,
        permissions: audience === "admin" && "permissions" in account ? account.permissions : []
      };
      next();
    })().catch(next);
  };
};

export const requirePermissions = (...permissions: string[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AuthenticationError());
      return;
    }
    const hasPermissions = permissions.every((permission) => req.auth?.permissions.includes(permission));
    if (!hasPermissions) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
};
