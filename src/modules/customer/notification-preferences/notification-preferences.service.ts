import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import { CustomerAccountRepository } from "../auth/auth.repository.js";
import type { UpdateNotificationPreferencesInput } from "./notification-preferences.validation.js";

type NotificationPreferences = {
  emailAlerts: boolean;
};

type NotificationPreferencesServiceDependencies = {
  events: DomainEventPublisher;
  customers?: CustomerAccountRepository;
};

export class NotificationPreferencesService {
  private readonly customers: CustomerAccountRepository;

  public constructor(private readonly dependencies: NotificationPreferencesServiceDependencies) {
    this.customers = dependencies.customers ?? new CustomerAccountRepository();
  }

  public async get(userId: string): Promise<NotificationPreferences> {
    const account = await this.customers.findById(userId);
    if (!account) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    return {
      emailAlerts: account.notificationPreferences?.emailAlerts ?? true
    };
  }

  public async update(
    userId: string,
    input: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferences> {
    const updated = await this.customers.updateById(userId, {
      $set: { "notificationPreferences.emailAlerts": input.emailAlerts }
    });
    if (!updated) {
      throw new ResourceNotFoundError("User profile not found.");
    }
    await this.dependencies.events.publish({
      type: "customer.notification-preferences-updated",
      aggregateId: userId,
      payload: { emailAlerts: input.emailAlerts }
    });
    return {
      emailAlerts: updated.notificationPreferences?.emailAlerts ?? input.emailAlerts
    };
  }
}
