import { getEnv } from "./env.js";

export const getDatabaseConfig = () => {
  const env = getEnv();
  return {
    uri: env.MONGODB_URI,
    databaseName: env.MONGODB_DATABASE
  };
};
