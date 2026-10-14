import { describe, expect, it } from "vitest";
import { realtimeEventsForMutation } from "../../src/realtime/realtime-events.js";

describe("realtime event mapping", () => {
  it("maps support message creation", () => {
    expect(
      realtimeEventsForMutation({
        fullPath: "/api/v1/support/tickets/:ticketId/messages",
        method: "POST",
        resource: "support"
      })
    ).toEqual(["support-message:new"]);
  });

  it("maps notification mutations and unread-count refreshes", () => {
    expect(
      realtimeEventsForMutation({
        fullPath: "/api/v1/notifications/:notificationId/read",
        method: "POST",
        resource: "notifications"
      })
    ).toEqual(["notification:read", "unread-count:updated"]);

    expect(
      realtimeEventsForMutation({
        fullPath: "/api/v1/notifications/:notificationId",
        method: "DELETE",
        resource: "notifications"
      })
    ).toEqual(["notification:deleted", "unread-count:updated"]);
  });

  it("does not publish realtime events for unrelated mutations", () => {
    expect(
      realtimeEventsForMutation({
        fullPath: "/api/v1/listings/:listingId/publish",
        method: "POST",
        resource: "listings"
      })
    ).toEqual([]);
  });
});
