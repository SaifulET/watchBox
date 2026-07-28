import { createLogger } from "../src/common/utils/logger.js";

createLogger({ service: "backfill-analytics" }).info(
  "Analytics backfill command is wired to backend snapshot collections"
);
