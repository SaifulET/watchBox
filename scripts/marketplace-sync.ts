import { createLogger } from "../src/common/utils/logger.js";

createLogger({ service: "marketplace-sync" }).info(
  "Marketplace sync command is wired to backend marketplace provider abstractions"
);
