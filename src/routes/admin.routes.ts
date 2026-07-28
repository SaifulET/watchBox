import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";
import { createAdminAuthRouter } from "../modules/admin/auth/auth.routes.js";
import type { RouteDependencies } from "./index.js";

export const createAdminRouter = (dependencies: RouteDependencies = {}): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Admin API",
      version: "0.1.0"
    });
  });

  router.use("/auth", createAdminAuthRouter(dependencies));

  return router;
};
