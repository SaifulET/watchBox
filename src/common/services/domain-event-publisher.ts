import { getRabbitMqConfig } from "../../config/rabbitmq.config.js";
import type { RabbitConnection } from "../../infrastructure/rabbitmq/connection.js";

type DomainEvent = {
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export class DomainEventPublisher {
  public constructor(private readonly connection?: RabbitConnection) {}

  public async publish(event: DomainEvent): Promise<void> {
    if (!this.connection) {
      return;
    }

    const config = getRabbitMqConfig();
    const channel = await this.connection.createConfirmChannel();
    try {
      await channel.assertExchange(config.domainExchange, "topic", { durable: true });
      channel.publish(
        config.domainExchange,
        event.type,
        Buffer.from(JSON.stringify(event)),
        {
          contentType: "application/json",
          deliveryMode: 2,
          messageId: `${event.type}:${event.aggregateId}:${Date.now()}`
        }
      );
      await channel.waitForConfirms();
    } finally {
      await channel.close();
    }
  }
}
