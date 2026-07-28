import { Router } from "express";
import { sendSuccess } from "../common/utils/api-response.js";

export const createCustomerRouter = (): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Customer API",
      version: "0.1.0"
    });
  });

  return router;
};
