import type { Express } from "express";

export type RegisteredRoute = {
  method: string;
  path: string;
  auth: string;
  permission: string;
  controller: string;
};

type ExpressRoute = {
  path: string;
  methods: Record<string, boolean>;
};

type ExpressLayer = {
  name?: string;
  regexp?: RegExp;
  route?: ExpressRoute;
  handle?: {
    stack?: ExpressLayer[];
  };
};

const normalizePath = (path: string): string => {
  const normalized = path.replace(/\/+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

const parseMountPath = (regexp?: RegExp): string => {
  if (!regexp) {
    return "";
  }
  const source = regexp.source;
  const match = /^\^\\\/(.+?)\\\/\?\(\?=\\\/\|\$\)$/.exec(source);
  if (!match?.[1]) {
    return "";
  }
  return `/${match[1].replace(/\\\//g, "/")}`;
};

const publicGetPrefixes = [
  "/api/v1/subscriptions/plans",
  "/api/v1/brands",
  "/api/v1/watch-models",
  "/api/v1/listings",
  "/api/v1/trader-collection",
  "/api/v1/traders",
  "/api/v1/marketplaces",
  "/api/v1/search",
  "/api/v1/content"
];

const inferAuth = (path: string, method: string): string => {
  if (path.startsWith("/api/v1/admin/auth")) {
    if (
      path.includes("/login") ||
      path.includes("/refresh") ||
      path.includes("/forgot-password") ||
      path.includes("/verify-reset-code") ||
      path.includes("/reset-password") ||
      path.includes("/mfa/challenge")
    ) {
      return "Public";
    }
    return "Admin";
  }
  if (path.startsWith("/api/v1/admin")) {
    return "Admin";
  }
  if (path.startsWith("/api/v1/webhooks")) {
    return "Public";
  }
  if (
    path.includes("/auth/login") ||
    path.includes("/auth/register") ||
    path.includes("/auth/refresh") ||
    path.includes("forgot-password") ||
    path.includes("reset-password") ||
    path.includes("verify-email") ||
    path.includes("verify-reset-code") ||
    path.includes("mfa/challenge")
  ) {
    return "Public";
  }
  if (method === "GET" && publicGetPrefixes.some((prefix) => path.startsWith(prefix))) {
    return "Public";
  }
  if (method === "POST" && path === "/api/v1/listings/:listingId/view") {
    return "Public";
  }
  if (path.startsWith("/api/v1")) {
    return "Customer";
  }
  return "-";
};

const inferPermission = (path: string): string => {
  if (!path.startsWith("/api/v1/admin") || path.startsWith("/api/v1/admin/auth")) {
    return "-";
  }
  const moduleName = path.split("/")[4] ?? "admin";
  return `admin:${moduleName}`;
};

const inferController = (path: string): string => {
  if (path.includes("/auth")) {
    return path.startsWith("/api/v1/admin") ? "AdminAuthController" : "CustomerAuthController";
  }
  if (path.startsWith("/api/v1/users")) {
    return "UserController";
  }
  if (path.startsWith("/health")) {
    return "HealthRoute";
  }
  if (path === "/api/v1") {
    return "CustomerRootRoute";
  }
  if (path === "/api/v1/admin") {
    return "AdminRootRoute";
  }
  if (path.startsWith("/internal")) {
    return "InternalRoute";
  }
  return "RegisteredController";
};

const walk = (layers: ExpressLayer[], prefix = ""): RegisteredRoute[] => {
  const routes: RegisteredRoute[] = [];
  for (const layer of layers) {
    if (layer.route) {
      const path = normalizePath(`${prefix}${layer.route.path}`);
      const methods = Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method.toUpperCase());
      for (const method of methods) {
        routes.push({
          method,
          path,
          auth: inferAuth(path, method),
          permission: inferPermission(path),
          controller: inferController(path)
        });
      }
      continue;
    }

    if (layer.handle?.stack) {
      routes.push(...walk(layer.handle.stack, normalizePath(`${prefix}${parseMountPath(layer.regexp)}`)));
    }
  }
  return routes;
};

const getRouterStack = (app: Express): ExpressLayer[] => {
  const candidate = app as unknown as { _router?: unknown };
  const router = candidate._router as { stack?: unknown } | undefined;
  return Array.isArray(router?.stack) ? (router.stack as ExpressLayer[]) : [];
};

export const extractRegisteredRoutes = (app: Express): RegisteredRoute[] => {
  const stack = getRouterStack(app);
  return walk(stack).sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
};
