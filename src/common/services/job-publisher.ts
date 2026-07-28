import { getRabbitMqConfig } from "../../config/rabbitmq.config.js";
import type { RabbitConnection } from "../../infrastructure/rabbitmq/connection.js";

type JobMessage = {
  type: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export class JobPublisher {
  public constructor(private readonly connection?: RabbitConnection) {}

  public async publish(job: JobMessage): Promise<void> {
    if (!this.connection) {
      return;
    }

    const config = getRabbitMqConfig();
    const channel = await this.connection.createConfirmChannel();
    try {
      await channel.assertExchange(config.jobExchange, "topic", { durable: true });
      channel.publish(config.jobExchange, job.type, Buffer.from(JSON.stringify(job)), {
        contentType: "application/json",
        deliveryMode: 2,
        messageId: job.idempotencyKey
      });
      await channel.waitForConfirms();
    } finally {
      await channel.close();
    }
  }
}
