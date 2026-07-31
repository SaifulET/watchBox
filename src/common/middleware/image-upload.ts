import type { RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../errors/app-error.js";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
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

export const requireSingleImage = (fieldName = "image"): RequestHandler => {
  const upload = imageUpload.single(fieldName);

  return (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(
          new ValidationError([
            {
              path: fieldName,
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
      next();
    });
  };
};
