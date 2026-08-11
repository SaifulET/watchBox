import mongoose from "mongoose";
import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { CustomerAccountModel } from "../../customer/auth/auth.model.js";
import { GeneratedApiRecordModel } from "../../generated-api/generated-api.model.js";
import type { EarningsTransactionsQueryInput } from "./earnings.validation.js";

type CustomerSnapshot = {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  email: string;
  avatarUrl?: string;
};

type EarningsTransaction = {
  id: string;
  user: {
    id: string | null;
    name: string;
    collectorId: string;
    avatar: string;
    email: string;
  };
  trxId: string;
  subscription: "Legacy" | "Pro" | "Basic";
  planName: string;
  price: string;
  amount: number;
  currency: string;
  date: string;
  dateString: string;
  acNumber: string;
  type: "All Users" | "Internal";
  status: string;
  createdAt: string;
  invoiceId: string | null;
  paymentIntentId: string | null;
};

type StripeEventRecord = {
  _id: mongoose.Types.ObjectId;
  data: Record<string, unknown>;
  createdAt: Date;
};

type SubscriptionRecord = {
  _id: mongoose.Types.ObjectId;
  ownerId?: string;
  data: Record<string, unknown>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const objectValue = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const formatMoney = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  }).format(date);

const relativeDate = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) {
    return "Just now";
  }
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatDate(date);
};

const subscriptionLabel = (plan: unknown): EarningsTransaction["subscription"] => {
  const normalized = stringValue(plan, "standard")
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (["elite", "elite_collector", "legacy", "enterprise"].includes(normalized)) {
    return "Legacy";
  }
  if (["pro", "premium"].includes(normalized)) {
    return "Pro";
  }
  return "Basic";
};

const planName = (plan: unknown): string => {
  const label = subscriptionLabel(plan);
  if (label === "Legacy") {
    return "Monthly Subscription";
  }
  return `${label} Subscription`;
};

const avatarFor = (customer: CustomerSnapshot | undefined, name: string): string =>
  customer?.avatarUrl ??
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=002B49&color=fff`;

const collectorIdFor = (id: string | null): string =>
  id ? `LA- ${id.slice(-4).toUpperCase()}` : "LA- ----";

const maskedAccount = (value: unknown, fallbackSeed: string): string => {
  const raw = stringValue(value);
  if (raw) {
    return raw;
  }
  return `**** **** **** *${fallbackSeed.slice(-3).padStart(3, "0")}`;
};

const stripeAmount = (object: Record<string, unknown>): number => {
  const cents =
    numberValue(object.amount_paid) ??
    numberValue(object.amount_received) ??
    numberValue(object.amount) ??
    numberValue(object.total) ??
    numberValue(object.amount_due);
  if (cents !== null) {
    return cents / 100;
  }
  return 0;
};

const subscriptionAmount = (data: Record<string, unknown>): number => {
  const amount =
    numberValue(data.lastInvoiceAmount) ??
    numberValue(data.lastPaymentAmount) ??
    numberValue(data.amount) ??
    numberValue(data.price);
  if (amount !== null) {
    return amount > 999 ? amount / 100 : amount;
  }
  return subscriptionLabel(data.plan) === "Legacy" ? 29.99 : 0;
};

export class AdminEarningsService {
  public async summary() {
    const transactions = await this.transactions();
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    const today = transactions
      .filter((transaction) => transaction.createdAt.slice(0, 10) === todayKey)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const thisMonth = transactions
      .filter((transaction) => transaction.createdAt.slice(0, 7) === monthKey)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const totalRevenue = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const currency = transactions[0]?.currency ?? "USD";

    return {
      today: { amount: today, formatted: formatMoney(today, currency) },
      thisMonth: { amount: thisMonth, formatted: formatMoney(thisMonth, currency) },
      totalRevenue: { amount: totalRevenue, formatted: formatMoney(totalRevenue, currency) },
      transactionCount: transactions.length
    };
  }

  public async listTransactions(input: EarningsTransactionsQueryInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const filtered = (await this.transactions()).filter((transaction) =>
      this.matchesTransaction(transaction, input)
    );
    const start = (page - 1) * limit;

    return {
      transactions: filtered.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit))
      }
    };
  }

  public async getTransaction(transactionId: string): Promise<EarningsTransaction> {
    const transaction = (await this.transactions()).find(
      (item) =>
        item.id === transactionId ||
        item.trxId.replace(/^#/, "") === transactionId.replace(/^#/, "")
    );
    if (!transaction) {
      throw new ResourceNotFoundError("Earnings transaction not found.");
    }
    return transaction;
  }

  public async exportTransactions(input: EarningsTransactionsQueryInput): Promise<string> {
    const { transactions } = await this.listTransactions({ ...input, page: 1, limit: 100000 });
    const rows = [
      [
        "Transaction ID",
        "Name",
        "Email",
        "Subscription",
        "Plan",
        "Amount",
        "Currency",
        "Date",
        "Type",
        "Status"
      ],
      ...transactions.map((transaction) => [
        transaction.trxId,
        transaction.user.name,
        transaction.user.email,
        transaction.subscription,
        transaction.planName,
        transaction.amount.toFixed(2),
        transaction.currency,
        transaction.dateString,
        transaction.type,
        transaction.status
      ])
    ];

    return rows.map((row) => row.map(this.csvCell).join(",")).join("\n");
  }

  public async refunds() {
    const records = await GeneratedApiRecordModel.find({
      resource: mongoose.trusted({ $in: ["refund", "refunds"] }),
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean();
    return records.map((record) => ({
      id: record._id.toString(),
      status: record.status,
      data: record.data,
      createdAt: record.createdAt.toISOString()
    }));
  }

  public async createRefund(actorId: string, paymentId: string) {
    const transaction = await this.getTransaction(paymentId);
    const record = await GeneratedApiRecordModel.create({
      resource: "refunds",
      scope: { paymentId },
      data: {
        paymentId,
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: "requested"
      },
      status: "requested",
      history: [
        {
          action: "admin.earnings.refund-requested",
          actorId,
          actorType: "admin",
          at: new Date(),
          metadata: { paymentId, amount: transaction.amount, currency: transaction.currency }
        }
      ]
    });

    return {
      id: record._id.toString(),
      status: record.status,
      data: record.data,
      createdAt: record.createdAt.toISOString()
    };
  }

  public async subscriptionRevenue() {
    const transactions = await this.transactions();
    return ["Legacy", "Pro", "Basic"].map((subscription) => {
      const tierTransactions = transactions.filter(
        (transaction) => transaction.subscription === subscription
      );
      const amount = tierTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      return {
        subscription,
        amount,
        formatted: formatMoney(amount, tierTransactions[0]?.currency ?? "USD"),
        count: tierTransactions.length
      };
    });
  }

  public async marketplaceFees() {
    const records = await GeneratedApiRecordModel.find({
      resource: mongoose.trusted({ $in: ["marketplace-fees", "orders", "payment-intent"] }),
      deletedAt: null
    })
      .sort({ createdAt: -1 })
      .lean();
    return records.map((record) => ({
      id: record._id.toString(),
      resource: record.resource,
      status: record.status,
      data: record.data,
      createdAt: record.createdAt.toISOString()
    }));
  }

  private async transactions(): Promise<EarningsTransaction[]> {
    const [events, subscriptions] = await Promise.all([
      GeneratedApiRecordModel.find({
        resource: "stripe-events",
        deletedAt: null,
        "data.type": mongoose.trusted({ $in: ["invoice.paid", "payment_intent.succeeded"] })
      })
        .sort({ createdAt: -1 })
        .lean<StripeEventRecord[]>(),
      GeneratedApiRecordModel.find({
        resource: "customer-subscriptions",
        deletedAt: null
      })
        .sort({ updatedAt: -1 })
        .lean<SubscriptionRecord[]>()
    ]);
    const ownerIds = new Set<string>();
    subscriptions.forEach((subscription) => {
      if (subscription.ownerId) {
        ownerIds.add(subscription.ownerId);
      }
    });

    const subscriptionByStripeId = new Map<string, SubscriptionRecord>();
    const subscriptionByCustomerId = new Map<string, SubscriptionRecord>();
    subscriptions.forEach((subscription) => {
      const stripeSubscriptionId = stringValue(subscription.data.stripeSubscriptionId);
      const stripeCustomerId = stringValue(subscription.data.stripeCustomerId);
      if (stripeSubscriptionId) {
        subscriptionByStripeId.set(stripeSubscriptionId, subscription);
      }
      if (stripeCustomerId) {
        subscriptionByCustomerId.set(stripeCustomerId, subscription);
      }
    });

    const eventTransactions = events.map((event) =>
      this.transactionFromStripeEvent(event, subscriptionByStripeId, subscriptionByCustomerId)
    );
    eventTransactions.forEach((transaction) => {
      if (transaction.user.id) {
        ownerIds.add(transaction.user.id);
      }
    });

    const customerMap = await this.customerMap([...ownerIds]);
    const seenInvoices = new Set(
      eventTransactions.map((transaction) => transaction.invoiceId).filter(Boolean)
    );
    const subscriptionTransactions = subscriptions
      .filter((subscription) => {
        const invoiceId = stringValue(subscription.data.lastInvoiceId);
        return (
          Boolean(subscription.data.lastPaymentAt || invoiceId) &&
          (!invoiceId || !seenInvoices.has(invoiceId))
        );
      })
      .map((subscription) => this.transactionFromSubscription(subscription, customerMap));

    return [...eventTransactions, ...subscriptionTransactions]
      .map((transaction) =>
        transaction.user.id && customerMap.has(transaction.user.id)
          ? this.withCustomer(transaction, customerMap.get(transaction.user.id))
          : transaction
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private transactionFromStripeEvent(
    event: StripeEventRecord,
    subscriptionByStripeId: Map<string, SubscriptionRecord>,
    subscriptionByCustomerId: Map<string, SubscriptionRecord>
  ): EarningsTransaction {
    const object = objectValue(objectValue(event.data.data).object);
    const stripeSubscriptionId = stringValue(object.subscription);
    const stripeCustomerId = stringValue(object.customer);
    const subscription =
      subscriptionByStripeId.get(stripeSubscriptionId) ??
      subscriptionByCustomerId.get(stripeCustomerId);
    const createdSeconds = numberValue(object.created);
    const createdAt = createdSeconds ? new Date(createdSeconds * 1000) : event.createdAt;
    const amount = stripeAmount(object);
    const currency = stringValue(object.currency, "USD").toUpperCase();
    const invoiceId = stringValue(object.id, event._id.toString());
    const ownerId = subscription?.ownerId ?? null;
    const fallbackName = ownerId ? "WatchBox Customer" : "Internal Account";

    return {
      id: event._id.toString(),
      user: {
        id: ownerId,
        name: fallbackName,
        collectorId: collectorIdFor(ownerId),
        avatar: avatarFor(undefined, fallbackName),
        email: stringValue(object.customer_email, "unknown@example.com")
      },
      trxId: `#${invoiceId.replace(/^in_/, "").slice(-8).toUpperCase()}`,
      subscription: subscriptionLabel(subscription?.data.plan),
      planName: planName(subscription?.data.plan),
      price: formatMoney(amount, currency),
      amount,
      currency,
      date: relativeDate(createdAt),
      dateString: formatDate(createdAt),
      acNumber: maskedAccount(object.payment_method, invoiceId),
      type: stringValue(subscription?.data.type) === "internal" ? "Internal" : "All Users",
      status: stringValue(object.status, "paid"),
      createdAt: createdAt.toISOString(),
      invoiceId,
      paymentIntentId: stringValue(object.payment_intent) || null
    };
  }

  private transactionFromSubscription(
    subscription: SubscriptionRecord,
    customers: Map<string, CustomerSnapshot>
  ): EarningsTransaction {
    const ownerId = subscription.ownerId ?? null;
    const customer = ownerId ? customers.get(ownerId) : undefined;
    const name = customer?.displayName ?? "WatchBox Customer";
    const email =
      customer?.email ?? stringValue(subscription.data.customerEmail, "unknown@example.com");
    const date = new Date(stringValue(subscription.data.lastPaymentAt) || subscription.updatedAt);
    const amount = subscriptionAmount(subscription.data);
    const currency = stringValue(subscription.data.currency, "USD").toUpperCase();
    const invoiceId = stringValue(subscription.data.lastInvoiceId, subscription._id.toString());

    return {
      id: subscription._id.toString(),
      user: {
        id: ownerId,
        name,
        collectorId: collectorIdFor(ownerId),
        avatar: avatarFor(customer, name),
        email
      },
      trxId: `#${invoiceId.replace(/^in_/, "").slice(-8).toUpperCase()}`,
      subscription: subscriptionLabel(subscription.data.plan),
      planName: planName(subscription.data.plan),
      price: formatMoney(amount, currency),
      amount,
      currency,
      date: relativeDate(date),
      dateString: formatDate(date),
      acNumber: maskedAccount(subscription.data.paymentMethodLast4, invoiceId),
      type: stringValue(subscription.data.type) === "internal" ? "Internal" : "All Users",
      status: subscription.status,
      createdAt: date.toISOString(),
      invoiceId,
      paymentIntentId: stringValue(subscription.data.lastPaymentIntentId) || null
    };
  }

  private withCustomer(
    transaction: EarningsTransaction,
    customer: CustomerSnapshot | undefined
  ): EarningsTransaction {
    if (!customer) {
      return transaction;
    }
    return {
      ...transaction,
      user: {
        id: customer._id.toString(),
        name: customer.displayName,
        collectorId: collectorIdFor(customer._id.toString()),
        avatar: avatarFor(customer, customer.displayName),
        email: customer.email
      }
    };
  }

  private async customerMap(userIds: string[]): Promise<Map<string, CustomerSnapshot>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const customers = await CustomerAccountModel.find({
      _id: mongoose.trusted({ $in: userIds }),
      deletedAt: null
    })
      .select("displayName email avatarUrl")
      .lean<CustomerSnapshot[]>();
    return new Map(customers.map((customer) => [customer._id.toString(), customer]));
  }

  private matchesTransaction(
    transaction: EarningsTransaction,
    input: EarningsTransactionsQueryInput
  ): boolean {
    if (input.type && transaction.type !== input.type) {
      return false;
    }
    if (
      input.subscription &&
      input.subscription !== "All Subscriptions" &&
      transaction.subscription !== input.subscription
    ) {
      return false;
    }
    if (input.q) {
      const query = input.q.toLowerCase();
      return [
        transaction.user.name,
        transaction.user.email,
        transaction.user.collectorId,
        transaction.trxId,
        transaction.planName
      ].some((value) => value.toLowerCase().includes(query));
    }
    return true;
  }

  private csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
