import type { Express } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { getEnv } from "../config/env.js";

export const registerSwagger = (app: Express): void => {
  if (getEnv().NODE_ENV === "production") {
    return;
  }

  const openApiPath = join(process.cwd(), "docs", "openapi", "customer.yaml");
  if (!existsSync(openApiPath)) {
    return;
  }

  const document = YAML.parse(readFileSync(openApiPath, "utf8")) as Record<string, unknown>;
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(document));
};
