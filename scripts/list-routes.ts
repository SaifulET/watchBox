import { createApp } from "../src/app.js";
import { extractRegisteredRoutes } from "./route-utils.js";

const routes = extractRegisteredRoutes(createApp());

console.log("METHOD PATH AUTH PERMISSION CONTROLLER");
for (const route of routes) {
  console.log(
    `${route.method} ${route.path} ${route.auth} ${route.permission} ${route.controller}`
  );
}
