import type { Request, RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../../common/errors/app-error.js";

export const reportProofMaxBytes = 10 * 1024 * 1024;
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: reportProofMaxBytes + 1,
    files: 5,
    fieldSize: 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!supportedImageTypes.has(file.mimetype)) {
      callback(
        new ValidationError([
          {
            path: "proofImages",
            message: "Only image/jpeg, image/png, image/webp, and image/gif proof images are supported."
          }
        ])
      );
      return;
    }
    callback(null, true);
  }
});

const proofFields = [
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: 5 },
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 5 },
  { name: "proof", maxCount: 1 },
  { name: "proofs", maxCount: 5 },
  { name: "attachment", maxCount: 1 },
  { name: "attachments", maxCount: 5 }
];

export const reportProofUpload: RequestHandler = (req, res, next) => {
  upload.fields(proofFields)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new ValidationError([
          {
            path: "proofImages",
            message:
              error.code === "LIMIT_FILE_SIZE"
                ? "Each proof image must be 10MB or smaller."
                : error.code === "LIMIT_FILE_COUNT"
                  ? "You can attach up to 5 proof images."
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

export const reportProofFiles = (req: Request): Express.Multer.File[] => {
  if (!req.files) {
    return [];
  }
  if (Array.isArray(req.files)) {
    return req.files.slice(0, 5);
  }
  const filesByField: Record<string, Express.Multer.File[]> = req.files;
  return proofFields.flatMap(({ name }) => filesByField[name] ?? []).slice(0, 5);
};
