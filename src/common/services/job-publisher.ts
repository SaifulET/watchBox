import { getRabbitMqConfig } from "../../config/rabbitmq.config.js";
import type { RabbitConnection } from "../../infrastructure/rabbitmq/connection.js";

type JobMessage = {
  type: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  queue?: {
    name: string;
    deadLetter?: boolean;
    routingKey?: string;
  };
};

export class JobPublisher {
  public constructor(private readonly connection?: RabbitConnection) {}

  public isAvailable(): boolean {
    return Boolean(this.connection);
  }

  public async publish(job: JobMessage): Promise<boolean> {
    if (!this.connection) {
      return false;
    }

    const config = getRabbitMqConfig();
    const channel = await this.connection.createConfirmChannel();
    try {
      await channel.assertExchange(config.jobExchange, "topic", { durable: true });
      if (job.queue) {
        if (job.queue.deadLetter) {
          await channel.assertExchange(config.deadLetterExchange, "topic", { durable: true });
        }
        await channel.assertQueue(job.queue.name, {
          durable: true,
          ...(job.queue.deadLetter ? { deadLetterExchange: config.deadLetterExchange } : {})
        });
        await channel.bindQueue(
          job.queue.name,
          config.jobExchange,
          job.queue.routingKey ?? job.type
        );
      }
      channel.publish(config.jobExchange, job.type, Buffer.from(JSON.stringify(job)), {
        contentType: "application/json",
        deliveryMode: 2,
        messageId: job.idempotencyKey
      });
      await channel.waitForConfirms();
      return true;
    } finally {
      await channel.close();
    }
  }
}
