import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../../../common/errors/app-error.js";

export type RevenueCatEvent = {
  id?: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: unknown;
  product_id?: string;
  entitlement_id?: string;
  entitlement_ids?: unknown;
  expiration_at_ms?: unknown;
  purchased_at_ms?: unknown;
  event_timestamp_ms?: unknown;
  store?: string;
  environment?: string;
  period_type?: string;
  cancel_reason?: string;
  transferred_from?: unknown;
  transferred_to?: unknown;
  subscriber_attributes?: unknown;
};

export type MappedRevenueCatSubscription = {
  plan: "elite_collector" | "standard";
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  revenuecatEventType: string;
  revenuecatProductId?: string;
  revenuecatEntitlementId?: string;
  store?: string;
  environment?: string;
};

const activateTypes = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "NON_RENEWING_PURCHASE",
  "TEMPORARY_ENTITLEMENT_GRANT"
]);

const cancelTypes = new Set(["CANCELLATION"]);
const expireTypes = new Set(["EXPIRATION"]);
const pastDueTypes = new Set(["BILLING_ISSUE"]);
const pausedTypes = new Set(["SUBSCRIPTION_PAUSED"]);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const extractRevenueCatEvent = (body: unknown): RevenueCatEvent | null => {
  console.log("body", body);
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const payload = body as Record<string, unknown>;
  const nested = payload.event;
  const source =
    typeof nested === "object" && nested !== null ? (nested as Record<string, unknown>) : payload;
  const type = stringValue(source.type);
  if (!type) {
    return null;
  }
  const event: RevenueCatEvent = { type };
  const id = stringValue(source.id) ?? stringValue(payload.id);
  const appUserId = stringValue(source.app_user_id);
  const originalAppUserId = stringValue(source.original_app_user_id);
  const productId = stringValue(source.product_id);
  const entitlementId = stringValue(source.entitlement_id);
  const store = stringValue(source.store);
  const environment = stringValue(source.environment);
  const periodType = stringValue(source.period_type);
  const cancelReason = stringValue(source.cancel_reason);
  if (id) {
    event.id = id;
  }
  if (appUserId) {
    event.app_user_id = appUserId;
  }
  if (originalAppUserId) {
    event.original_app_user_id = originalAppUserId;
  }
  if (source.aliases !== undefined) {
    event.aliases = source.aliases;
  }
  if (productId) {
    event.product_id = productId;
  }
  if (entitlementId) {
    event.entitlement_id = entitlementId;
  }
  if (source.entitlement_ids !== undefined) {
    event.entitlement_ids = source.entitlement_ids;
  }
  if (source.expiration_at_ms !== undefined) {
    event.expiration_at_ms = source.expiration_at_ms;
  }
  if (source.purchased_at_ms !== undefined) {
    event.purchased_at_ms = source.purchased_at_ms;
  }
  if (source.event_timestamp_ms !== undefined) {
    event.event_timestamp_ms = source.event_timestamp_ms;
  }
  if (store) {
    event.store = store;
  }
  if (environment) {
    event.environment = environment;
  }
  if (periodType) {
    event.period_type = periodType;
  }
  if (cancelReason) {
    event.cancel_reason = cancelReason;
  }
  if (source.transferred_from !== undefined) {
    event.transferred_from = source.transferred_from;
  }
  if (source.transferred_to !== undefined) {
    event.transferred_to = source.transferred_to;
  }
  if (source.subscriber_attributes !== undefined) {
    event.subscriber_attributes = source.subscriber_attributes;
  }
  return event;
};

export const revenueCatUserCandidates = (event: RevenueCatEvent): string[] => {
  const aliases = Array.isArray(event.aliases)
    ? event.aliases.map((value) => stringValue(value)).filter((value): value is string => Boolean(value))
    : [];
  const transferredTo = Array.isArray(event.transferred_to)
    ? event.transferred_to.map((value) => stringValue(value)).filter((value): value is string => Boolean(value))
    : [stringValue(event.transferred_to)].filter((value): value is string => Boolean(value));
  return [
    ...transferredTo,
    event.app_user_id,
    event.original_app_user_id,
    ...aliases,
    subscriberEmail(event.subscriber_attributes)
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
};

const subscriberEmail = (attributes: unknown): string | undefined => {
  if (typeof attributes !== "object" || attributes === null || Array.isArray(attributes)) {
    return undefined;
  }
  const email = (attributes as Record<string, unknown>).$email ?? (attributes as Record<string, unknown>).email;
  if (typeof email === "string") {
    return stringValue(email);
  }
  if (typeof email === "object" && email !== null && !Array.isArray(email)) {
    return stringValue((email as Record<string, unknown>).value);
  }
  return undefined;
};

const timestampFromMs = (value: unknown): string | null => {
  const timestamp = numberValue(value);
  return timestamp ? new Date(timestamp).toISOString() : null;
};

const isStillEntitled = (event: RevenueCatEvent): boolean => {
  const expiration = numberValue(event.expiration_at_ms);
  if (!expiration) {
    return activateTypes.has(event.type) || event.type === "TEST" || cancelTypes.has(event.type);
  }
  return expiration > Date.now();
};

export const mapRevenueCatEvent = (event: RevenueCatEvent): MappedRevenueCatSubscription => {
  const currentPeriodEnd = timestampFromMs(event.expiration_at_ms);
  const entitled = isStillEntitled(event);
  const mapped: MappedRevenueCatSubscription = {
    plan: "standard",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd,
    revenuecatEventType: event.type
  };
  if (event.product_id) {
    mapped.revenuecatProductId = event.product_id;
  }
  if (event.entitlement_id) {
    mapped.revenuecatEntitlementId = event.entitlement_id;
  }
  if (event.store) {
    mapped.store = event.store;
  }
  if (event.environment) {
    mapped.environment = event.environment;
  }

  if (expireTypes.has(event.type) || (event.type === "TEST" && !entitled)) {
    mapped.plan = "standard";
    mapped.status = "expired";
    return mapped;
  }
  if (pausedTypes.has(event.type)) {
    mapped.plan = entitled ? "elite_collector" : "standard";
    mapped.status = "paused";
    return mapped;
  }
  if (pastDueTypes.has(event.type)) {
    mapped.plan = "elite_collector";
    mapped.status = "past_due";
    return mapped;
  }
  if (cancelTypes.has(event.type)) {
    mapped.plan = entitled ? "elite_collector" : "standard";
    mapped.status = entitled ? "active" : "expired";
    mapped.cancelAtPeriodEnd = entitled;
    return mapped;
  }
  if (activateTypes.has(event.type) || event.type === "TEST" || event.type === "TRANSFER") {
    mapped.plan = entitled || event.type === "TRANSFER" ? "elite_collector" : "standard";
    mapped.status = mapped.plan === "elite_collector" ? "active" : "expired";
    mapped.cancelAtPeriodEnd = false;
  }
  return mapped;
};

export const verifyRevenueCatAuthorization = (
  authorization: string | undefined,
  secret: string | undefined,
  nodeEnv: string
): void => {
  if (!secret) {
    if (nodeEnv !== "production") {
      return;
    }
    throw new AuthenticationError("RevenueCat webhook secret is required.");
  }
  const provided = authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!provided) {
    throw new AuthenticationError("RevenueCat webhook authorization is required.");
  }
  const expected = createHmac("sha256", "revenuecat-webhook").update(secret).digest();
  const actual = createHmac("sha256", "revenuecat-webhook").update(provided).digest();
  if (!timingSafeEqual(expected, actual)) {
    throw new AuthenticationError("RevenueCat webhook authorization is invalid.");
  }
};
