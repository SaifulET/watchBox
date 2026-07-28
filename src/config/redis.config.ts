import { getEnv } from "./env.js";

export const getRedisConfig = () => ({
  url: getEnv().REDIS_URL
});
