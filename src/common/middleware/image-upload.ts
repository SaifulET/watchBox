import type { RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../errors/app-error.js";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fieldSize: 25 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!supportedImageTypes.has(file.mimetype)) {
      callback(
        new ValidationError([
          {
            path: "image",
            message: "Only image/jpeg, image/png, image/webp, and image/gif files are supported."
          }
        ])
      );
      return;
    }
    callback(null, true);
  }
});

export const requireSingleImage = (fieldName: string | string[] = "image"): RequestHandler => {
  const fieldNames = Array.isArray(fieldName) ? fieldName : [fieldName];
  const primaryFieldName = fieldNames[0] ?? "image";
  const upload =
    fieldNames.length === 1
      ? imageUpload.single(primaryFieldName)
      : imageUpload.fields(fieldNames.map((name) => ({ name, maxCount: 1 })));

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          new ValidationError([
            {
              path: primaryFieldName,
              message: error.code === "LIMIT_FILE_SIZE" ? "Image must be 10MB or smaller." : error.message
            }
          ])
        );
        return;
      }
      if (error) {
        next(error);
        return;
      }
      if (!req.file && req.files && !Array.isArray(req.files)) {
        const filesByField = req.files as Record<string, Express.Multer.File[]>;
        req.file = fieldNames.flatMap((name) => filesByField[name] ?? [])[0];
      }
      next();
    });
  };
};
