import { getEnv } from "../src/config/env.js";
import { createLogger } from "../src/common/utils/logger.js";

const env = getEnv();
const logger = createLogger({ service: "create-atlas-indexes" });

logger.info(
  {
    searchIndex: env.ATLAS_SEARCH_INDEX,
    vectorIndex: env.ATLAS_VECTOR_INDEX
  },
  "Atlas Search and Vector Search index names loaded for backend index creation"
);
