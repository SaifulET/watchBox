import { Router } from "express";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { sendSuccess } from "../common/utils/api-response.js";
import type { RabbitConnection } from "../infrastructure/rabbitmq/connection.js";
import { checkRabbitMqHealth } from "../infrastructure/rabbitmq/connection.js";
import type { RedisClient } from "../infrastructure/redis/client.js";
import { checkRedisHealth } from "../infrastructure/redis/client.js";
import { checkMongoHealth } from "../infrastructure/database/mongo.js";

export type HealthRouteDependencies = {
  redis?: RedisClient;
  rabbitMq?: RabbitConnection;
};

type DependencyCheck = {
  name: string;
  check: () => Promise<boolean>;
};

const runChecks = async (checks: DependencyCheck[]) => {
  const results = await Promise.all(
    checks.map(async (dependency) => {
      const startedAt = Date.now();
      try {
        return {
          name: dependency.name,
          ok: await dependency.check(),
          latencyMs: Date.now() - startedAt
        };
      } catch (error) {
        return {
          name: dependency.name,
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Unknown dependency error"
        };
      }
    })
  );

  return {
    status: results.every((result) => result.ok) ? "ok" : "degraded",
    checks: results
  };
};

export const createHealthRouter = (dependencies: HealthRouteDependencies = {}): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, { status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  router.get("/live", (req, res) => {
    sendSuccess(res, req.requestId, { status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  router.get(
    "/ready",
    asyncHandler(async (req, res) => {
      const checks: DependencyCheck[] = [{ name: "mongodb", check: checkMongoHealth }];
      if (dependencies.redis) {
        checks.push({
          name: "redis",
          check: () => checkRedisHealth(dependencies.redis as RedisClient)
        });
      }
      if (dependencies.rabbitMq) {
        checks.push({
          name: "rabbitmq",
          check: () => checkRabbitMqHealth(dependencies.rabbitMq as RabbitConnection)
        });
      }

      const readiness = await runChecks(checks);
      sendSuccess(res, req.requestId, readiness, readiness.status === "ok" ? 200 : 503);
    })
  );

  return router;
};
