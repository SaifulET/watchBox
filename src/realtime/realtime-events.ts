import type { GeneratedEndpointDefinition } from "../modules/generated-api/generated-api.service.js";
import type { RealtimeEventName } from "./socket-realtime.service.js";

export const realtimeEventsForMutation = (
  definition: Pick<GeneratedEndpointDefinition, "fullPath" | "method" | "resource">
): RealtimeEventName[] => {
  const { fullPath, method } = definition;

  if (fullPath === "/api/v1/support/tickets" && method === "POST") {
    return ["support-ticket:created"];
  }
  if (fullPath.endsWith("/support/tickets/:ticketId/messages") && method === "POST") {
    return ["support-message:new"];
  }
  if (fullPath.endsWith("/support/tickets/:ticketId/close") && method === "POST") {
    return ["support-ticket:closed"];
  }
  if (fullPath.endsWith("/listings/:listingId/contact-seller") && method === "POST") {
    return ["seller-contact:created"];
  }
  if (fullPath === "/api/v1/notifications/read-all" && method === "POST") {
    return ["notifications:read-all", "unread-count:updated"];
  }
  if (fullPath.endsWith("/notifications/:notificationId/read") && method === "POST") {
    return ["notification:read", "unread-count:updated"];
  }
  if (fullPath === "/api/v1/notifications" && method === "DELETE") {
    return ["notifications:cleared", "unread-count:updated"];
  }
  if (fullPath.endsWith("/notifications/:notificationId") && method === "DELETE") {
    return ["notification:deleted", "unread-count:updated"];
  }
  if (definition.resource === "notifications" && method === "POST") {
    return ["notification:new", "unread-count:updated"];
  }
  return [];
};
