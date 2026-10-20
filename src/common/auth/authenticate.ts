import type { RequestHandler } from "express";
import { AuthenticationError, AuthorizationError } from "../errors/app-error.js";
import type { AuthenticatedActor } from "./auth.types.js";
import { resolveAdminPermissions } from "../permissions/admin-permissions.js";
import { TokenService, type TokenAudience } from "../../modules/customer/auth/token.service.js";
import {
  AdminAccountRepository,
  AuthSessionRepository,
  CustomerAccountRepository
} from "../../modules/customer/auth/auth.repository.js";

const bearerPrefix = "Bearer ";

export const authenticateAccessToken = async (
  token: string,
  audience: TokenAudience
): Promise<AuthenticatedActor> => {
  const tokens = new TokenService();
  const sessions = new AuthSessionRepository();
  const customers = new CustomerAccountRepository();
  const admins = new AdminAccountRepository();
  const verified = tokens.verifyAccessToken(token, audience);
  const [session, account] = await Promise.all([
    sessions.findActiveById(verified.sessionId, audience),
    audience === "customer" ? customers.findById(verified.subject) : admins.findById(verified.subject)
  ]);
  if (!session || session.accountId.toString() !== verified.subject) {
    throw new AuthenticationError("The session is no longer active.");
  }
  if (!account || account.status !== "active") {
    throw new AuthenticationError("The account is no longer active.");
  }

  return {
    id: verified.subject,
    audience,
    sessionId: verified.sessionId,
    permissions:
      audience === "admin" && "permissions" in account && "roles" in account
        ? resolveAdminPermissions(account.permissions, account.roles)
        : []
  };
};

export const authenticate = (audience: TokenAudience): RequestHandler => {
  return (req, _res, next) => {
    void (async () => {
      const header = req.header("authorization");
      if (!header?.startsWith(bearerPrefix)) {
        throw new AuthenticationError();
      }

      const token = header.slice(bearerPrefix.length);
      req.auth = await authenticateAccessToken(token, audience);
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
    const hasPermissions = permissions.every((permission) =>
      req.auth?.permissions.includes(permission)
    );
    if (!hasPermissions) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
};
