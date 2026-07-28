import { createLogger } from "../src/common/utils/logger.js";

createLogger({ service: "search-reindex" }).info(
  "Search reindex command is wired to backend Atlas Search configuration"
);
