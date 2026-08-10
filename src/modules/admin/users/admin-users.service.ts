import type { FilterQuery } from "mongoose";
import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import type { DomainEventPublisher } from "../../../common/services/domain-event-publisher.js";
import type {
  CustomerAccount,
  CustomerAccountDocument
} from "../../customer/auth/auth.model.js";
import type { AdminUsersQueryInput } from "./admin-users.validation.js";
import {
  AdminUsersRepository,
  type CustomerSubscriptionSnapshot
} from "./admin-users.repository.js";

type AdminUsersServiceDependencies = {
  events: DomainEventPublisher;
  users?: AdminUsersRepository;
};

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  plan: "ELITE" | "PREMIUM" | "FREE";
  status: "Active" | "Suspended" | "Pending";
  rawStatus: string;
  emailVerified: boolean;
  lastActive: string;
  lastLoginAt: string | null;
  avatar: string;
  phone: string;
  joinedDate: string;
  region: string;
  billingHistory: Array<{
    id: string;
    date: string;
    amount: string;
  }>;
  createdAt: string;
  updatedAt: string;
  activeSessions?: number;
};

type ListUsersResult = {
  users: DashboardUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalActive: number;
    totalUsers: number;
    suspended: number;
    pending: number;
  };
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeTier = (value: unknown): DashboardUser["plan"] | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "all tiers" || normalized === "all") {
    return null;
  }
  if (normalized === "elite" || normalized === "elite_collector") {
    return "ELITE";
  }
  if (normalized === "premium") {
    return "PREMIUM";
  }
  if (normalized === "free" || normalized === "standard") {
    return "FREE";
  }
  return null;
};

const planFromSubscription = (
  subscription: CustomerSubscriptionSnapshot | undefined
): DashboardUser["plan"] => {
  const plan = normalizeTier(subscription?.data.plan);
  return plan ?? "FREE";
};

const displayStatus = (account: CustomerAccountDocument): DashboardUser["status"] => {
  if (account.status === "suspended") {
    return "Suspended";
  }
  if (!account.emailVerified) {
    return "Pending";
  }
  return "Active";
};

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);

const formatRelative = (date: Date | undefined): string => {
  if (!date) {
    return "Never";
  }
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
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatDate(date);
};

const moneyAmount = (value: unknown): string => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "$0.00";
};

const billingHistoryFromSubscription = (
  subscription: CustomerSubscriptionSnapshot | undefined
): DashboardUser["billingHistory"] => {
  if (!subscription) {
    return [];
  }
  const invoiceId = typeof subscription.data.lastInvoiceId === "string" ? subscription.data.lastInvoiceId : null;
  const paidAt = typeof subscription.data.lastPaymentAt === "string" ? subscription.data.lastPaymentAt : null;
  if (!invoiceId && !paidAt) {
    return [];
  }
  return [
    {
      id: invoiceId ?? "current",
      date: paidAt ? formatDate(new Date(paidAt)) : formatDate(new Date()),
      amount: moneyAmount(subscription.data.lastInvoiceAmount)
    }
  ];
};

const avatarFor = (account: CustomerAccountDocument): string =>
  account.avatarUrl ??
  `https://ui-avatars.com/api/?name=${encodeURIComponent(account.displayName)}&background=002B49&color=fff`;

export class AdminUsersService {
  private readonly users: AdminUsersRepository;

  public constructor(private readonly dependencies: AdminUsersServiceDependencies) {
    this.users = dependencies.users ?? new AdminUsersRepository();
  }

  public async listUsers(input: AdminUsersQueryInput): Promise<ListUsersResult> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const filter = this.buildFilter(input);
    const customers = await this.users.listCustomers(filter);
    const subscriptions = await this.subscriptionMap(customers.map((customer) => customer._id.toString()));
    const tier = normalizeTier(input.tier);
    const sorted = customers
      .map((customer) => this.serializeCustomer(customer, subscriptions.get(customer._id.toString())))
      .filter((customer) => !tier || customer.plan === tier)
      .sort((left, right) => this.compareUsers(left, right, input));
    const start = (page - 1) * limit;
    const paginated = sorted.slice(start, start + limit);
    const summary = await this.summary();

    return {
      users: paginated,
      pagination: {
        page,
        limit,
        total: sorted.length,
        totalPages: Math.max(1, Math.ceil(sorted.length / limit))
      },
      summary
    };
  }

  public async summary(): Promise<ListUsersResult["summary"]> {
    const [totalUsers, activeAccounts, suspended, unverifiedActive] = await Promise.all([
      this.users.countCustomers({ deletedAt: null }),
      this.users.countCustomers({ deletedAt: null, status: "active" }),
      this.users.countCustomers({ deletedAt: null, status: "suspended" }),
      this.users.countCustomers({ deletedAt: null, status: "active", emailVerified: false })
    ]);
    return {
      totalActive: Math.max(0, activeAccounts - unverifiedActive),
      totalUsers,
      suspended,
      pending: unverifiedActive
    };
  }

  public async getUser(userId: string): Promise<DashboardUser> {
    const customer = await this.requireCustomer(userId);
    const subscriptions = await this.subscriptionMap([userId]);
    const activeSessions = await this.users.countActiveCustomerSessions(userId);
    return {
      ...this.serializeCustomer(customer, subscriptions.get(userId)),
      activeSessions
    };
  }

  public async setStatus(
    actorId: string,
    userId: string,
    status: "active" | "suspended"
  ): Promise<DashboardUser> {
    const updated = await this.users.updateCustomerById(userId, { $set: { status } });
    if (!updated) {
      throw new ResourceNotFoundError("Customer user not found.");
    }
    if (status === "suspended") {
      await this.users.revokeCustomerSessions(userId);
    }
    await this.dependencies.events.publish({
      type: `admin.users.${status === "suspended" ? "suspended" : "unsuspended"}`,
      aggregateId: userId,
      payload: { actorId }
    });
    const subscriptions = await this.subscriptionMap([userId]);
    return this.serializeCustomer(updated, subscriptions.get(userId));
  }

  private buildFilter(input: AdminUsersQueryInput): FilterQuery<CustomerAccount> {
    const filter: FilterQuery<CustomerAccount> = { deletedAt: null };
    if (input.status) {
      filter.status = input.status;
    }
    if (input.q) {
      const pattern = new RegExp(escapeRegex(input.q), "i");
      filter.$or = [{ displayName: pattern }, { email: pattern }, { phone: pattern }, { country: pattern }];
    }
    return filter;
  }

  private async requireCustomer(userId: string): Promise<CustomerAccountDocument> {
    const customer = await this.users.findCustomerById(userId);
    if (!customer) {
      throw new ResourceNotFoundError("Customer user not found.");
    }
    return customer;
  }

  private async subscriptionMap(
    userIds: string[]
  ): Promise<Map<string, CustomerSubscriptionSnapshot>> {
    const subscriptions = await this.users.listSubscriptionSnapshots(userIds);
    return new Map(
      subscriptions
        .filter((subscription): subscription is CustomerSubscriptionSnapshot & { ownerId: string } =>
          Boolean(subscription.ownerId)
        )
        .map((subscription) => [subscription.ownerId, subscription])
    );
  }

  private serializeCustomer(
    account: CustomerAccountDocument,
    subscription: CustomerSubscriptionSnapshot | undefined
  ): DashboardUser {
    return {
      id: account._id.toString(),
      name: account.displayName,
      email: account.email,
      plan: planFromSubscription(subscription),
      status: displayStatus(account),
      rawStatus: account.status,
      emailVerified: account.emailVerified,
      lastActive: formatRelative(account.lastLoginAt),
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
      avatar: avatarFor(account),
      phone: account.phone ?? "Not provided",
      joinedDate: formatDate(account.createdAt),
      region: account.country ?? "Unknown",
      billingHistory: billingHistoryFromSubscription(subscription),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  private compareUsers(
    left: DashboardUser,
    right: DashboardUser,
    input: AdminUsersQueryInput
  ): number {
    const direction = input.sortDirection === "desc" ? -1 : 1;
    const field = input.sortBy ?? "name";
    const leftValue = this.sortValue(left, field);
    const rightValue = this.sortValue(right, field);
    return leftValue.localeCompare(rightValue) * direction;
  }

  private sortValue(user: DashboardUser, field: NonNullable<AdminUsersQueryInput["sortBy"]>): string {
    if (field === "name") {
      return user.name.toLowerCase();
    }
    if (field === "email") {
      return user.email.toLowerCase();
    }
    if (field === "lastActive") {
      return user.lastLoginAt ?? "";
    }
    if (field === "joinedDate") {
      return user.createdAt;
    }
    return user.status.toLowerCase();
  }
}
