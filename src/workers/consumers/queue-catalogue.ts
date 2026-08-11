export const workerQueues = [
  "watchbox.outbox.dispatch",
  "watchbox.analytics.events",
  "watchbox.notifications.dispatch",
  "watchbox.exports.generate",
  "watchbox.bulk-email.campaigns"
] as const;

export type WorkerQueue = (typeof workerQueues)[number];
