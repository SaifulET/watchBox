import { getEnv } from "./env.js";

export const getAiConfig = () => {
  const env = getEnv();
  return {
    provider: env.AI_PROVIDER,
    serviceUrl: env.AI_SERVICE_URL,
    serviceToken: env.AI_SERVICE_TOKEN,
    model: env.AI_MODEL,
    embeddingModel: env.AI_EMBEDDING_MODEL
  };
};

