import { Router, type RequestHandler } from "express";
import { authenticate, requirePermissions } from "../../common/auth/authenticate.js";
import { asyncHandler } from "../../common/middleware/async-handler.js";
import { validate } from "../../common/middleware/validate.js";
import { DomainEventPublisher } from "../../common/services/domain-event-publisher.js";
import { JobPublisher } from "../../common/services/job-publisher.js";
import type { RouteDependencies } from "../../routes/index.js";
import { requiredApiEndpoints } from "../../../scripts/api-inventory.js";
import {
  GeneratedApiService,
  type GeneratedEndpointDefinition,
  type GeneratedListResult
} from "./generated-api.service.js";
import {
  generatedBodySchema,
  generatedParamsSchema,
  generatedQuerySchema
} from "./generated-api.validation.js";
import { validateWebhookSignature } from "./webhook-signature.middleware.js";

const alreadyImplemented = (path: string): boolean =>
  path.includes("/auth/") || path.startsWith("/api/v1/users/me");

const jobSegments = new Set([
  "upload-urls",
  "upload-url",
  "reprocess",
  "auto-detect",
  "export",
  "sync",
  "retry",
  "send",
  "schedule",
  "publish",
  "preview",
  "test",
  "image-search",
  "webhooks"
]);

const mutationActions = new Set([
  "submit",
  "publish",
  "pause",
  "resume",
  "archive",
  "mark-sold",
  "reserve",
  "unreserve",
  "contact-seller",
  "report",
  "view",
  "confirm",
  "run",
  "enable",
  "disable",
  "read",
  "read-all",
  "impression",
  "click",
  "hide",
  "feedback",
  "link-listing",
  "payment-intent",
  "cancel",
  "confirm-shipment",
  "confirm-delivery",
  "dispute",
  "close",
  "bulk-actions",
  "suspend",
  "unsuspend",
  "verify-email",
  "reset-password",
  "revoke-sessions",
  "restore",
  "activate",
  "deactivate",
  "duplicate",
  "assign",
  "extend",
  "refund",
  "resolve",
  "dismiss",
  "status"
]);

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

const toLocalPath = (fullPath: string): string => fullPath.replace(/^\/api\/v1/, "") || "/";

const isPublicEndpoint = (method: string, fullPath: string): boolean => {
  if (fullPath.startsWith("/api/v1/webhooks")) {
    return true;
  }
  if (method === "GET" && publicGetPrefixes.some((prefix) => fullPath.startsWith(prefix))) {
    return true;
  }
  return method === "POST" && fullPath === "/api/v1/listings/:listingId/view";
};

const routeAuth = (method: string, fullPath: string): GeneratedEndpointDefinition["auth"] => {
  if (fullPath.startsWith("/api/v1/admin")) {
    return "admin";
  }
  if (isPublicEndpoint(method, fullPath)) {
    return "public";
  }
  return "customer";
};

const staticSegments = (localPath: string): string[] =>
  localPath
    .split("/")
    .filter((segment) => segment.length > 0 && !segment.startsWith(":"));

const resourceFromPath = (fullPath: string): string => {
  const localPath = toLocalPath(fullPath);
  const segments = staticSegments(localPath);
  if (segments[0] === "admin") {
    return `admin-${segments[1] ?? "root"}`;
  }
  if (segments[0] === "webhooks") {
    return `webhook-${segments[1] ?? "event"}`;
  }
  if (segments[0] === "me") {
    return segments[1] ?? "me";
  }
  return segments[0] ?? "resource";
};

const actionFromPath = (method: string, fullPath: string): string => {
  const localPath = toLocalPath(fullPath);
  const segments = staticSegments(localPath);
  const resource = resourceFromPath(fullPath);
  const last = segments.at(-1) ?? method.toLowerCase();
  const verb =
    method === "GET"
      ? last
      : mutationActions.has(last)
        ? last
        : method === "POST"
          ? "created"
          : method === "PATCH"
            ? "updated"
            : method === "DELETE"
              ? "deleted"
              : method.toLowerCase();
  return `${resource}.${verb}`;
};

const isJobEndpoint = (fullPath: string): boolean =>
  jobSegments.has(resourceFromPath(fullPath)) ||
  staticSegments(toLocalPath(fullPath)).some((segment) => jobSegments.has(segment));

const isCacheableEndpoint = (method: string, fullPath: string): boolean =>
  method === "GET" &&
  (fullPath.includes("/search") ||
    fullPath.includes("/recommendations") ||
    fullPath.includes("/dashboard") ||
    fullPath.includes("/analytics"));

const ownerScoped = (auth: GeneratedEndpointDefinition["auth"], fullPath: string): boolean =>
  auth === "customer" || fullPath.includes("/me/");

const permissionFromPath = (fullPath: string): string | undefined => {
  if (!fullPath.startsWith("/api/v1/admin")) {
    return undefined;
  }
  const moduleName = fullPath.split("/")[4] ?? "admin";
  return `admin:${moduleName}`;
};

const definitionFromEndpoint = (
  endpoint: (typeof requiredApiEndpoints)[number]
): GeneratedEndpointDefinition => {
  const auth = routeAuth(endpoint.method, endpoint.path);
  const definition: GeneratedEndpointDefinition = {
    method: endpoint.method,
    fullPath: endpoint.path,
    localPath: toLocalPath(endpoint.path),
    resource: resourceFromPath(endpoint.path),
    action: actionFromPath(endpoint.method, endpoint.path),
    auth,
    ownerScoped: ownerScoped(auth, endpoint.path),
    job: isJobEndpoint(endpoint.path),
    cache: isCacheableEndpoint(endpoint.method, endpoint.path)
  };
  const permission = permissionFromPath(endpoint.path);
  if (permission) {
    definition.permission = permission;
  }
  return definition;
};

const paramsObject = (params: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );

const bodyObject = (body: unknown): Record<string, unknown> =>
  typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

const protectedMiddleware = (definition: GeneratedEndpointDefinition): RequestHandler[] => {
  if (definition.auth === "public") {
    return [];
  }
  if (definition.auth === "admin") {
    const middleware: RequestHandler[] = [authenticate("admin")];
    if (definition.permission) {
      middleware.push(requirePermissions(definition.permission));
    }
    return middleware;
  }
  return [authenticate("customer")];
};

export const createGeneratedApiRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();
  const serviceDependencies: ConstructorParameters<typeof GeneratedApiService>[0] = {
    events: new DomainEventPublisher(dependencies.rabbitMq),
    jobs: new JobPublisher(dependencies.rabbitMq)
  };
  if (dependencies.redis) {
    serviceDependencies.redis = dependencies.redis;
  }
  const service = new GeneratedApiService(serviceDependencies);

  for (const endpoint of requiredApiEndpoints) {
    if (alreadyImplemented(endpoint.path)) {
      continue;
    }

    const definition = definitionFromEndpoint(endpoint);
    const middleware: RequestHandler[] = [...protectedMiddleware(definition)];
    if (definition.fullPath.startsWith("/api/v1/webhooks")) {
      middleware.push(validateWebhookSignature());
    }
    if (definition.localPath.includes(":")) {
      middleware.push(validate({ params: generatedParamsSchema }));
    }
    if (definition.method === "GET") {
      middleware.push(validate({ query: generatedQuerySchema }));
    }
    if (["POST", "PATCH"].includes(definition.method)) {
      middleware.push(validate({ body: generatedBodySchema }));
    }

    router[endpoint.method.toLowerCase() as "get" | "post" | "patch" | "delete" | "put"](
      definition.localPath,
      ...middleware,
      asyncHandler(async (req, res) => {
        const actor: { id?: string; audience?: string } = {};
        if (req.auth?.id) {
          actor.id = req.auth.id;
        }
        if (req.auth?.audience) {
          actor.audience = req.auth.audience;
        }
        const params = paramsObject(req.params);
        const body = bodyObject(req.body);

        if (definition.method === "GET") {
          const hasIdentifier = Object.keys(params).some((key) => key.toLowerCase().endsWith("id"));
          const actionLike = isJobEndpoint(definition.fullPath) && !hasIdentifier;
          if (!actionLike && !hasIdentifier && Object.keys(params).length === 0) {
            const list: GeneratedListResult = await service.list(definition, req.query, actor);
            res.status(200).json({
              success: true,
              data: list.items,
              meta: {
                page: list.page,
                limit: list.limit,
                total: list.total,
                totalPages: list.totalPages,
                requestId: req.requestId
              }
            });
            return;
          }
          const data = actionLike
            ? await service.action(definition, params, body, actor)
            : await service.get(definition, params, actor);
          res.status(200).json({ success: true, data, meta: { requestId: req.requestId } });
          return;
        }

        if (definition.method === "POST") {
          const lastSegment = staticSegments(definition.localPath).at(-1) ?? "";
          const isAction = mutationActions.has(lastSegment) || Object.keys(params).length > 0;
          const data = isAction
            ? await service.action(definition, params, body, actor)
            : await service.create(definition, params, body, actor);
          res.status(isAction ? 200 : 201).json({ success: true, data, meta: { requestId: req.requestId } });
          return;
        }

        if (definition.method === "PATCH") {
          const data = await service.update(definition, params, body, actor);
          res.status(200).json({ success: true, data, meta: { requestId: req.requestId } });
          return;
        }

        if (definition.method === "DELETE") {
          const data = await service.remove(definition, params, actor);
          res.status(200).json({ success: true, data, meta: { requestId: req.requestId } });
        }
      })
    );
  }

  return router;
};
