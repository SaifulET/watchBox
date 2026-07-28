import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { getEnv } from "../src/config/env.js";
import {
  adminPermissions,
  adminRoles,
  rolePermissionMatrix
} from "../src/common/permissions/admin-permissions.js";
import { createLogger } from "../src/common/utils/logger.js";

const targets = ["all", "admin", "permissions", "plans", "catalogue", "marketplaces"] as const;
type SeedTarget = (typeof targets)[number];

const parseTarget = (): SeedTarget => {
  const target = process.argv[2] ?? "all";
  if (!targets.includes(target as SeedTarget)) {
    throw new Error(`Unknown seed target "${target}". Expected one of: ${targets.join(", ")}`);
  }
  return target as SeedTarget;
};

export const seedPermissions = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection was not established.");
  }

  await db.collection("adminPermissions").createIndex({ code: 1 }, { unique: true });
  await db.collection("adminRoles").createIndex({ code: 1 }, { unique: true });

  await db.collection("adminPermissions").bulkWrite(
    adminPermissions.map((code) => ({
      updateOne: {
        filter: { code },
        update: {
          $set: { code, description: `Allows ${code}`, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        upsert: true
      }
    }))
  );

  await db.collection("adminRoles").bulkWrite(
    adminRoles.map((code) => ({
      updateOne: {
        filter: { code },
        update: {
          $set: { code, permissions: rolePermissionMatrix[code], updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        upsert: true
      }
    }))
  );
};

export const seedSettings = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection was not established.");
  }

  await db.collection("applicationSettings").updateOne(
    { key: "platform" },
    {
      $set: {
        key: "platform",
        value: {
          name: "WatchBox",
          defaultCurrency: "GBP",
          maintenanceMode: false
        },
        updatedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
};

export const runSeed = async (target: SeedTarget): Promise<void> => {
  if (target === "all" || target === "admin" || target === "permissions") {
    await seedPermissions();
  }
  if (
    target === "all" ||
    target === "plans" ||
    target === "catalogue" ||
    target === "marketplaces"
  ) {
    await seedSettings();
  }
};

const main = async (): Promise<void> => {
  const target = parseTarget();
  await executeSeed(target);
};

export const executeSeed = async (target: SeedTarget): Promise<void> => {
  const env = getEnv();
  const logger = createLogger({ service: "seed", target });

  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DATABASE });
  await runSeed(target);
  await mongoose.disconnect();

  logger.info({ target }, "Seed completed");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
