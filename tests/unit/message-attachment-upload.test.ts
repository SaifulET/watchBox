import express, {
  type NextFunction,
  type Request,
  type Response
} from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  messageAttachmentFiles,
  messageAttachmentMaxBytes,
  messageAttachmentsUpload
} from "../../src/common/middleware/message-attachment-upload.js";

const createUploadApp = () => {
  const app = express();
  app.post("/attachments", messageAttachmentsUpload, (req, res) => {
    res.status(200).json({
      sizes: messageAttachmentFiles(req).map((file) => file.size)
    });
  });
  app.use(
    (
      error: Error & { statusCode?: number; details?: unknown },
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      res.status(error.statusCode ?? 500).json({
        message: error.message,
        details: error.details
      });
    }
  );
  return app;
};

describe("message attachment upload", () => {
  it("accepts a file that is exactly 4MB", async () => {
    const response = await request(createUploadApp())
      .post("/attachments")
      .attach("attachments", Buffer.alloc(messageAttachmentMaxBytes), "document.pdf")
      .expect(200);

    expect(response.body).toEqual({ sizes: [messageAttachmentMaxBytes] });
  });

  it("rejects a file larger than 4MB", async () => {
    const response = await request(createUploadApp())
      .post("/attachments")
      .attach("attachments", Buffer.alloc(messageAttachmentMaxBytes + 1), "too-large.pdf")
      .expect(400);

    expect(response.body).toMatchObject({
      details: [
        {
          path: "attachments",
          message: "Each attachment must be 4MB or smaller."
        }
      ]
    });
  });
});
