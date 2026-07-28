import mongoose from "mongoose";
import { getEnv } from "../src/config/env.js";
import { createLogger } from "../src/common/utils/logger.js";

const main = async (): Promise<void> => {
  const env = getEnv();
  const logger = createLogger({ service: "create-indexes" });
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DATABASE });
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection was not established.");
  }

  await db.collection("adminPermissions").createIndex({ code: 1 }, { unique: true });
  await db.collection("adminRoles").createIndex({ code: 1 }, { unique: true });
  await db.collection("applicationSettings").createIndex({ key: 1 }, { unique: true });
  await db.collection("outboxEvents").createIndex({ status: 1, createdAt: 1 });
  await db.collection("processedEvents").createIndex({ eventId: 1, consumer: 1 }, { unique: true });
  await db.collection("idempotencyKeys").createIndex({ key: 1, scope: 1 }, { unique: true });
  await db.collection("idempotencyKeys").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  await mongoose.disconnect();
  logger.info("Backend MongoDB indexes ensured");
};

void main();
