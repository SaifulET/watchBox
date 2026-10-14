import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { ValidationError } from "../errors/app-error.js";
import {
  deleteObject,
  uploadObject
} from "../../infrastructure/storage/s3-storage.js";

export const messageAttachmentMaxBytes = 4 * 1024 * 1024;

export type StoredMessageAttachment = {
  id: string;
  key: string;
  url: string;
  name: string;
  contentType: string;
  size: number;
};

const safeFileName = (value: string): string =>
  Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .slice(0, 255);

export const deleteMessageAttachments = async (
  attachments: StoredMessageAttachment[]
): Promise<void> => {
  await Promise.allSettled(attachments.map(({ key }) => deleteObject(key)));
};

export const storeMessageAttachments = async (
  keyPrefix: string,
  files: Express.Multer.File[]
): Promise<StoredMessageAttachment[]> => {
  const attachments: StoredMessageAttachment[] = [];

  try {
    for (const file of files) {
      if (file.size > messageAttachmentMaxBytes) {
        throw new ValidationError([
          {
            path: "attachments",
            message: "Each attachment must be 4MB or smaller."
          }
        ]);
      }
      const id = randomUUID();
      const rawExtension = extname(file.originalname).toLowerCase();
      const extension = /^\.[a-z0-9]{1,10}$/.test(rawExtension) ? rawExtension : "";
      const key = `${keyPrefix}/${id}${extension}`;
      const contentType = file.mimetype || "application/octet-stream";
      const url = await uploadObject({
        key,
        body: file.buffer,
        contentType
      });
      attachments.push({
        id,
        key,
        url,
        name: safeFileName(file.originalname),
        contentType,
        size: file.size
      });
    }
    return attachments;
  } catch (error) {
    await deleteMessageAttachments(attachments);
    throw error;
  }
};
