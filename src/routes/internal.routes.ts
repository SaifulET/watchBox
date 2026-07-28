import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";

export const createInternalRouter = (): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Internal API",
      version: "0.1.0"
    });
  });

  return router;
};
