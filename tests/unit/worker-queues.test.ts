import { describe, expect, it } from "vitest";
import { workerQueues } from "../../src/workers/consumers/queue-catalogue.js";

describe("worker queue catalogue", () => {
  it("keeps backend domain queues", () => {
    expect(workerQueues).toEqual([
      "watchbox.outbox.dispatch",
      "watchbox.analytics.events",
      "watchbox.notifications.dispatch",
      "watchbox.exports.generate"
    ]);
  });
});
