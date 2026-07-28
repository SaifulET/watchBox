import type { Express } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { getEnv } from "../config/env.js";
import { requiredApiEndpoints } from "../../scripts/api-inventory.js";

type OpenApiOperation = {
  tags: string[];
  summary: string;
  security?: Array<Record<string, never[]>>;
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: Record<string, unknown>;
      };
    };
  };
  responses: Record<string, { description: string }>;
};

type OpenApiDocument = {
  openapi?: string;
  info?: Record<string, unknown>;
  servers?: Array<Record<string, unknown>>;
  tags?: Array<{ name: string }>;
  paths?: Record<string, Record<string, OpenApiOperation>>;
  components?: Record<string, unknown>;
};

const pathToOpenApi = (path: string): string => path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

const tagFromPath = (path: string): string => {
  const segments = path.split("/").filter(Boolean);
  if (segments[2] === "admin") {
    return `Admin ${segments[3] ?? "API"}`;
  }
  if (segments[2] === "webhooks") {
    return "Webhooks";
  }
  return segments[2] ? segments[2].replace(/-/g, " ") : "API";
};

const hasRequestBody = (method: string): boolean => ["POST", "PATCH", "PUT"].includes(method);

const isPublic = (path: string): boolean =>
  path.includes("/auth/login") ||
  path.includes("/auth/register") ||
  path.includes("/auth/refresh") ||
  path.includes("forgot-password") ||
  path.includes("reset-password") ||
  path.includes("verify-email") ||
  path.includes("verify-reset-code") ||
  path.includes("mfa/challenge") ||
  path.startsWith("/api/v1/webhooks");

const buildOperation = (method: string, path: string): OpenApiOperation => {
  const operation: OpenApiOperation = {
    tags: [tagFromPath(path)],
    summary: `${method} ${path}`,
    responses: {
      "200": {
        description: "Standard WatchBox API response."
      }
    }
  };
  if (!isPublic(path)) {
    operation.security = [{ bearerAuth: [] }];
  }
  if (hasRequestBody(method)) {
    operation.requestBody = {
      required: method !== "DELETE",
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true
          }
        }
      }
    };
  }
  return operation;
};

const addInventoryPaths = (document: OpenApiDocument): OpenApiDocument => {
  const paths = document.paths ?? {};
  for (const endpoint of requiredApiEndpoints) {
    const openApiPath = pathToOpenApi(endpoint.path);
    paths[openApiPath] ??= {};
    paths[openApiPath][endpoint.method.toLowerCase()] ??= buildOperation(
      endpoint.method,
      endpoint.path
    );
  }
  document.paths = paths;
  document.components = {
    ...(document.components ?? {}),
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  };
  return document;
};

export const registerSwagger = (app: Express): void => {
  if (getEnv().NODE_ENV === "production") {
    return;
  }

  const openApiPath = join(process.cwd(), "docs", "openapi", "customer.yaml");
  if (!existsSync(openApiPath)) {
    return;
  }

  const parsed = YAML.parse(readFileSync(openApiPath, "utf8")) as OpenApiDocument;
  const document = addInventoryPaths(parsed);
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));
};
