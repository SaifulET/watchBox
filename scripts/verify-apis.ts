import { createApp } from "../src/app.js";
import { requiredApiEndpoints } from "./api-inventory.js";
import { extractRegisteredRoutes } from "./route-utils.js";

const registeredRoutes = new Set(
  extractRegisteredRoutes(createApp()).map((route) => `${route.method} ${route.path}`)
);

const missingRoutes = requiredApiEndpoints.filter(
  (endpoint) => !registeredRoutes.has(`${endpoint.method} ${endpoint.path}`)
);

if (missingRoutes.length > 0) {
  console.error(`Missing ${missingRoutes.length} required API routes:`);
  for (const endpoint of missingRoutes) {
    console.error(`${endpoint.method} ${endpoint.path}`);
  }
  process.exit(1);
}

console.log(`All ${requiredApiEndpoints.length} required API routes are registered.`);
