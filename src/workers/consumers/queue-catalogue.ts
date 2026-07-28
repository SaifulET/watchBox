export const workerQueues = [
  "watchbox.outbox.dispatch",
  "watchbox.analytics.events",
  "watchbox.notifications.dispatch",
  "watchbox.exports.generate"
] as const;

export type WorkerQueue = (typeof workerQueues)[number];
