import { createLogger } from "../src/common/utils/logger.js";

createLogger({ service: "backfill-embeddings" }).info(
  "Embedding backfill command is wired to the backend AI provider abstraction"
);
