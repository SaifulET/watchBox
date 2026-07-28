import mongoose from "mongoose";
import { getDatabaseConfig } from "../../config/database.config.js";
import type { WatchboxLogger } from "../../common/utils/logger.js";

export const connectMongo = async (logger: WatchboxLogger): Promise<typeof mongoose> => {
  const config = getDatabaseConfig();
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  await mongoose.connect(config.uri, {
    dbName: config.databaseName,
    autoIndex: true
  });
  logger.info("MongoDB connected");
  return mongoose;
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};

export const checkMongoHealth = async (): Promise<boolean> => {
  if (
    mongoose.connection.readyState !== mongoose.ConnectionStates.connected ||
    !mongoose.connection.db
  ) {
    return false;
  }
  const result = await mongoose.connection.db.admin().ping();
  return result.ok === 1;
};
