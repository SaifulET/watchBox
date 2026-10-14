import type { Request, RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../errors/app-error.js";
import { messageAttachmentMaxBytes } from "../services/message-attachment-storage.js";

export { messageAttachmentMaxBytes } from "../services/message-attachment-storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Busboy reports LIMIT_FILE_SIZE when the stream reaches the configured
    // limit, so use one extra byte and enforce the exact maximum in the service.
    fileSize: messageAttachmentMaxBytes + 1,
    files: 5,
    fieldSize: 1024 * 1024
  }
});

const attachmentFields = [
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: 5 },
  { name: "attachment", maxCount: 1 },
  { name: "attachments", maxCount: 5 }
];

export const messageAttachmentsUpload: RequestHandler = (req, res, next) => {
  upload.fields(attachmentFields)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new ValidationError([
          {
            path: "attachments",
            message:
              error.code === "LIMIT_FILE_SIZE"
                ? "Each attachment must be 4MB or smaller."
                : error.message
          }
        ])
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};

export const messageAttachmentFiles = (req: Request): Express.Multer.File[] => {
  if (!req.files) {
    return [];
  }
  if (Array.isArray(req.files)) {
    return req.files;
  }
  const filesByField: Record<string, Express.Multer.File[]> = req.files;
  return attachmentFields.flatMap(({ name }) => filesByField[name] ?? []);
};
