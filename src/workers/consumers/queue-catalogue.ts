export const workerQueues = [
  "watchbox.outbox.dispatch",
  "watchbox.analytics.events",
  "watchbox.notifications.dispatch",
  "watchbox.exports.generate",
  "watchbox.bulk-email.campaigns",
  "watchbox.chrono24.listings.refresh",
  "watchbox.chrono24.snapshots.create",
  "watchbox.chrono24.analytics.recalculate",
  "watchbox.chrono24.market-insights.recalculate"
] as const;

export type WorkerQueue = (typeof workerQueues)[number];
