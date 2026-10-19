import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../common/middleware/async-handler.js";
import { sendSuccess } from "../common/utils/api-response.js";
import { readStoredObject } from "../infrastructure/storage/s3-storage.js";

const sendStoredObject = async (req: Request, res: Response): Promise<void> => {
  const key = decodeURIComponent((req.path ?? "").replace(/^\/+/, ""));
  const object = await readStoredObject(key);
  res.setHeader("Content-Type", object.contentType);
  res.setHeader("Content-Length", String(object.contentLength));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  res.status(200).send(object.body);
};

export const createInternalRouter = (): Router => {
  const router = Router();
  const uploadsRouter = Router();

  router.get("/", (req, res) => {
    sendSuccess(res, req.requestId, {
      name: "WatchBox Internal API",
      version: "0.1.0"
    });
  });

  uploadsRouter.get(/.*/, asyncHandler(sendStoredObject));
  uploadsRouter.head(/.*/, asyncHandler(sendStoredObject));
  router.use("/uploads", uploadsRouter);

  return router;
};
