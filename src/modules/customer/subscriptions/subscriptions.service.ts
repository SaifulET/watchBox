import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthenticationError, ConflictError, ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { getEnv } from "../../../config/env.js";
import { getPaymentConfig } from "../../../config/payment.config.js";
import { LocalPaymentProvider, StripePaymentProvider, type PaymentProvider } from "../../../infrastructure/external/stripe/stripe-provider.js";
import { CustomerAccountModel } from "../auth/auth.model.js";
import { GeneratedApiRecordModel, type GeneratedApiRecordDocument } from "../../generated-api/generated-api.model.js";
import type { CheckoutInput, PortalInput } from "./subscriptions.validation.js";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

const elitePlan = {
  id: "elite_collector",
  name: "Elite Collector",
  price: 29.99,
  currency: "USD",
  interval: "month",
  features: [
    "Unlimited Reference Searches",
    "All Time Historical Indexing",
    "AI Image Recognition Search",
    "Market Sparklines & Trends",
    "Auction Results Integration",
    "Personalized Portfolio Analytics"
  ]
};

const standardPlan = {
  id: "standard",
  name: "Standard",
  price: 0,
  currency: "USD",
  interval: "forever",
  features: [
    "5 Monthly Reference Searches",
    "3 Months Historical Indexing"
  ]
};

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const serializeSubscription = (record: GeneratedApiRecordDocument | null) => ({
  plan: record?.data.plan ?? "standard",
  status: record?.status ?? "active",
  stripeCustomerId: record?.data.stripeCustomerId ?? null,
  stripeSubscriptionId: record?.data.stripeSubscriptionId ?? null,
  currentPeriodEnd: record?.data.currentPeriodEnd ?? null,
  cancelAtPeriodEnd: record?.data.cancelAtPeriodEnd ?? false
});

export class SubscriptionsService {
  private readonly payments: PaymentProvider;

  public constructor(paymentProvider?: PaymentProvider) {
    this.payments = paymentProvider ?? (getPaymentConfig().stripeSecretKey ? new StripePaymentProvider() : new LocalPaymentProvider());
  }

  public plans() {
    return {
      currentDefault: "standard",
      plans: [standardPlan, elitePlan]
    };
  }

  public async status(userId: string) {
    const record = await this.subscriptionForUser(userId);
    return serializeSubscription(record);
  }

  public async checkout(userId: string, input: CheckoutInput) {
    const env = getEnv();
    const config = getPaymentConfig();
    if (!config.stripeElitePriceId) {
      throw new ConflictError("Stripe Elite price ID is required.");
    }
    const account = await CustomerAccountModel.findOne({ _id: userId, deletedAt: null });
    if (!account) {
      throw new ResourceNotFoundError("User not found.");
    }
    const subscription = await this.subscriptionForUser(userId);
    const stripeCustomerId = stringValue(subscription?.data.stripeCustomerId) ??
      (await this.payments.createCustomer({
        email: account.email,
        name: account.displayName,
        metadata: { userId }
      })).id;
    await this.upsertSubscription(userId, {
      plan: subscription?.data.plan ?? "standard",
      stripeCustomerId
    }, "customer-subscriptions.customer-linked", "active");
    const session = await this.payments.createCheckoutSession({
      customerId: stripeCustomerId,
      priceId: config.stripeElitePriceId,
      successUrl: input.successUrl ?? `${env.WEB_APP_URL.replace(/\/+$/, "")}/subscription/success`,
      cancelUrl: input.cancelUrl ?? `${env.WEB_APP_URL.replace(/\/+$/, "")}/subscription/cancel`,
      clientReferenceId: userId,
      metadata: {
        userId,
        plan: input.plan
      }
    });
    return {
      plan: input.plan,
      checkoutSessionId: session.id,
      url: session.url
    };
  }

  public async portal(userId: string, input: PortalInput) {
    const env = getEnv();
    const subscription = await this.subscriptionForUser(userId);
    const stripeCustomerId = stringValue(subscription?.data.stripeCustomerId);
    if (!stripeCustomerId) {
      throw new ConflictError("No Stripe customer exists for this user.");
    }
    return this.payments.createBillingPortalSession({
      customerId: stripeCustomerId,
      returnUrl: input.returnUrl ?? `${env.WEB_APP_URL.replace(/\/+$/, "")}/account/subscription`
    });
  }

  public async handleStripeWebhook(rawBody: Buffer | undefined, signature: string | undefined, parsedBody: unknown) {
    const event = this.verifyStripeEvent(rawBody, signature, parsedBody);
    const existingEvent = await GeneratedApiRecordModel.findOne({
      resource: "stripe-events",
      "scope.eventId": event.id,
      deletedAt: null
    }).select("_id");
    if (existingEvent) {
      return { received: true, duplicate: true, eventId: event.id };
    }
    await GeneratedApiRecordModel.create({
      resource: "stripe-events",
      scope: { eventId: event.id, type: event.type },
      data: event as unknown as Record<string, unknown>,
      status: "received",
      history: [
        {
          action: "stripe-events.received",
          actorType: "stripe",
          at: new Date(),
          metadata: { eventId: event.id, type: event.type }
        }
      ]
    });
    await this.applyStripeEvent(event);
    return { received: true, duplicate: false, eventId: event.id, type: event.type };
  }

  private verifyStripeEvent(rawBody: Buffer | undefined, signature: string | undefined, parsedBody: unknown): StripeEvent {
    const config = getPaymentConfig();
    if (!config.stripeWebhookSecret) {
      if (getEnv().NODE_ENV !== "production" && typeof parsedBody === "object" && parsedBody !== null) {
        return parsedBody as StripeEvent;
      }
      throw new AuthenticationError("Stripe webhook secret is required.");
    }
    if (!rawBody || !signature) {
      throw new AuthenticationError("Stripe webhook signature is required.");
    }
    const timestamp = signature.split(",").find((part) => part.startsWith("t="))?.slice(2);
    const signatureValue = signature.split(",").find((part) => part.startsWith("v1="))?.slice(3);
    if (!timestamp || !signatureValue) {
      throw new AuthenticationError("Stripe webhook signature is invalid.");
    }
    const expected = createHmac("sha256", config.stripeWebhookSecret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signatureValue, "hex");
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new AuthenticationError("Stripe webhook signature is invalid.");
    }
    return JSON.parse(rawBody.toString("utf8")) as StripeEvent;
  }

  private async applyStripeEvent(event: StripeEvent): Promise<void> {
    if (event.type === "checkout.session.completed") {
      await this.applyCheckoutSession(event.data.object);
      return;
    }
    if (event.type.startsWith("customer.subscription.")) {
      await this.applySubscription(event.data.object, event.type);
      return;
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      await this.applyInvoice(event.data.object, event.type);
    }
  }

  private async applyCheckoutSession(object: Record<string, unknown>): Promise<void> {
    const userId = stringValue(object.client_reference_id) ?? this.metadataValue(object, "userId");
    if (!userId) {
      return;
    }
    await this.upsertSubscription(userId, {
      plan: "elite_collector",
      stripeCustomerId: stringValue(object.customer),
      stripeSubscriptionId: stringValue(object.subscription),
      checkoutSessionId: stringValue(object.id)
    }, "customer-subscriptions.checkout-completed", "active");
  }

  private async applySubscription(object: Record<string, unknown>, type: string): Promise<void> {
    const userId = this.metadataValue(object, "userId") ?? await this.userIdFromStripeCustomer(stringValue(object.customer));
    if (!userId) {
      return;
    }
    const status = stringValue(object.status) ?? "active";
    const deleted = type === "customer.subscription.deleted";
    await this.upsertSubscription(userId, {
      plan: deleted ? "standard" : "elite_collector",
      stripeCustomerId: stringValue(object.customer),
      stripeSubscriptionId: stringValue(object.id),
      stripeStatus: status,
      currentPeriodEnd: this.stripeTimestamp(object.current_period_end),
      cancelAtPeriodEnd: Boolean(object.cancel_at_period_end)
    }, `customer-subscriptions.${type}`, deleted ? "active" : status);
  }

  private async applyInvoice(object: Record<string, unknown>, type: string): Promise<void> {
    const subscriptionId = stringValue(object.subscription);
    if (!subscriptionId) {
      return;
    }
    const record = await GeneratedApiRecordModel.findOne({
      resource: "customer-subscriptions",
      "data.stripeSubscriptionId": subscriptionId,
      deletedAt: null
    });
    if (!record?.ownerId) {
      return;
    }
    const paid = type === "invoice.paid";
    await this.upsertSubscription(record.ownerId, {
      plan: paid ? "elite_collector" : record.data.plan,
      stripeCustomerId: stringValue(object.customer),
      stripeSubscriptionId: subscriptionId,
      lastInvoiceId: stringValue(object.id),
      lastInvoiceStatus: stringValue(object.status),
      lastPaymentAt: paid ? new Date().toISOString() : record.data.lastPaymentAt
    }, `customer-subscriptions.${type}`, paid ? "active" : "past_due");
  }

  private metadataValue(object: Record<string, unknown>, key: string): string | undefined {
    const metadata = object.metadata;
    return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? stringValue((metadata as Record<string, unknown>)[key])
      : undefined;
  }

  private stripeTimestamp(value: unknown): string | undefined {
    const timestamp = numberValue(value);
    return timestamp ? new Date(timestamp * 1000).toISOString() : undefined;
  }

  private async userIdFromStripeCustomer(stripeCustomerId: string | undefined): Promise<string | undefined> {
    if (!stripeCustomerId) {
      return undefined;
    }
    const record = await GeneratedApiRecordModel.findOne({
      resource: "customer-subscriptions",
      "data.stripeCustomerId": stripeCustomerId,
      deletedAt: null
    }).select("ownerId");
    return record?.ownerId ?? undefined;
  }

  private subscriptionForUser(userId: string): Promise<GeneratedApiRecordDocument | null> {
    return GeneratedApiRecordModel.findOne({
      resource: "customer-subscriptions",
      ownerId: userId,
      "scope.kind": "current",
      deletedAt: null
    });
  }

  private async upsertSubscription(userId: string, data: Record<string, unknown>, action: string, status: string): Promise<void> {
    const existing = await this.subscriptionForUser(userId);
    const nextData = {
      ...(existing?.data ?? {}),
      ...data,
      updatedAt: new Date().toISOString()
    };
    if (existing) {
      existing.data = nextData;
      existing.status = status;
      existing.history.push({
        action,
        actorId: userId,
        actorType: "stripe",
        at: new Date(),
        metadata: nextData
      });
      await existing.save();
      return;
    }
    await GeneratedApiRecordModel.create({
      resource: "customer-subscriptions",
      ownerId: userId,
      scope: { kind: "current" },
      data: nextData,
      status,
      history: [
        {
          action,
          actorId: userId,
          actorType: "stripe",
          at: new Date(),
          metadata: nextData
        }
      ]
    });
  }
}
