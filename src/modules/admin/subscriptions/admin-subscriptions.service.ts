import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ResourceNotFoundError } from "../../../common/errors/app-error.js";
import { AdminAccountModel } from "../../customer/auth/auth.model.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type {
  PlanBodyInput,
  PlanFeaturesBodyInput,
  PromotionBodyInput,
  SettingsBodyInput
} from "./admin-subscriptions.validation.js";

type PlanFeature = { text: string; active: boolean };

const defaultPlans = [
  {
    id: "free",
    name: "Free",
    price: "0",
    annualPrice: "0",
    badge: "Standard",
    isPopular: false,
    status: "active",
    features: [
      { text: "5 Active Watches", active: true },
      { text: "Standard Market Prices", active: true },
      { text: "AI Visual Search", active: false }
    ]
  },
  {
    id: "premium",
    name: "Premium",
    price: "49",
    annualPrice: "499",
    badge: "Gold",
    isPopular: true,
    status: "active",
    features: [
      { text: "Unlimited Searches", active: true },
      { text: "AI Visual Search", active: true },
      { text: "Market Analytics", active: true }
    ]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "299",
    annualPrice: "2999",
    badge: "Platinum",
    isPopular: false,
    status: "active",
    features: [
      { text: "All Premium Features", active: true },
      { text: "API Access (REST/Webhooks)", active: true },
      { text: "Dedicated Account Manager", active: true }
    ]
  }
];

const defaultSettings = {
  trialPeriodDays: 14,
  autoRenewal: true
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const planIdFromName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || randomUUID();

const serializePlan = (record: GeneratedApiRecordDocument) => ({
  id: stringValue(record.data.id, record.scope.key ?? record._id.toString()),
  name: stringValue(record.data.name, "Untitled Plan"),
  price: stringValue(record.data.price, "0"),
  annualPrice: stringValue(record.data.annualPrice, "0"),
  badge: stringValue(record.data.badge, "Custom"),
  isPopular: Boolean(record.data.isPopular),
  features: Array.isArray(record.data.features) ? record.data.features : [],
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

const serializePromotion = (record: GeneratedApiRecordDocument) => {
  const discountType = stringValue(record.data.discountType, "percentage");
  const discountValue = Number(record.data.discountValue ?? 0);
  const duration = stringValue(record.data.duration, "Limited time");
  return {
    id: record._id.toString(),
    code: stringValue(record.data.code, "PROMO"),
    discountType,
    discountValue,
    duration,
    description: `${discountValue}${discountType === "percentage" ? "%" : " USD"} Off / ${duration}`,
    planIds: Array.isArray(record.data.planIds) ? record.data.planIds : [],
    expiresAt: record.data.expiresAt ?? null,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
};

export class AdminSubscriptionsService {
  public async listPlans() {
    await this.ensureDefaultPlans();
    const records = await GeneratedApiRecordModel.find({
      resource: "subscription-plans",
      deletedAt: null,
      status: mongoose.trusted({ $ne: "deleted" })
    }).sort({ createdAt: 1 });
    return records.map(serializePlan);
  }

  public async getPlan(planId: string) {
    return serializePlan(await this.requirePlan(planId));
  }

  public async createPlan(actorId: string, input: PlanBodyInput) {
    const planId = planIdFromName(input.name);
    const record = await GeneratedApiRecordModel.create({
      resource: "subscription-plans",
      scope: { key: planId },
      data: {
        id: planId,
        ...input
      },
      status: "active",
      history: [this.history("admin.subscriptions.plan-created", actorId, { planId })]
    });
    return serializePlan(record);
  }

  public async updatePlan(actorId: string, planId: string, input: PlanBodyInput) {
    const record = await this.requirePlan(planId);
    record.data = {
      ...record.data,
      ...input,
      id: stringValue(record.data.id, planId)
    };
    record.history.push(this.history("admin.subscriptions.plan-updated", actorId, { planId }));
    await record.save();
    return serializePlan(record);
  }

  public async updatePlanFeatures(actorId: string, planId: string, input: PlanFeaturesBodyInput) {
    const record = await this.requirePlan(planId);
    record.data = {
      ...record.data,
      features: input.features
    };
    record.history.push(
      this.history("admin.subscriptions.plan-features-updated", actorId, { planId })
    );
    await record.save();
    return serializePlan(record);
  }

  public async setPlanStatus(actorId: string, planId: string, status: "active" | "inactive") {
    const record = await this.requirePlan(planId);
    record.status = status;
    record.history.push(this.history(`admin.subscriptions.plan-${status}`, actorId, { planId }));
    await record.save();
    return serializePlan(record);
  }

  public async duplicatePlan(actorId: string, planId: string) {
    const source = await this.requirePlan(planId);
    const sourcePlan = serializePlan(source);
    const nextName = `${sourcePlan.name} Copy`;
    return this.createPlan(actorId, {
      name: nextName,
      price: sourcePlan.price,
      annualPrice: sourcePlan.annualPrice,
      badge: sourcePlan.badge,
      isPopular: false,
      features: sourcePlan.features as PlanFeature[]
    });
  }

  public async deletePlan(actorId: string, planId: string) {
    const record = await this.requirePlan(planId);
    record.status = "deleted";
    record.deletedAt = new Date();
    record.history.push(this.history("admin.subscriptions.plan-deleted", actorId, { planId }));
    await record.save();
    return { deleted: true };
  }

  public async settings() {
    const record = await this.settingsRecord();
    return {
      ...defaultSettings,
      ...record?.data
    };
  }

  public async updateSettings(actorId: string, input: SettingsBodyInput) {
    const existing = await this.settingsRecord();
    if (existing) {
      existing.data = input;
      existing.history.push(this.history("admin.subscriptions.settings-updated", actorId, input));
      await existing.save();
      return existing.data;
    }
    const record = await GeneratedApiRecordModel.create({
      resource: "subscription-settings",
      scope: { key: "global" },
      data: input,
      status: "active",
      history: [this.history("admin.subscriptions.settings-updated", actorId, input)]
    });
    return record.data;
  }

  public async listPromotions() {
    const records = await GeneratedApiRecordModel.find({
      resource: "subscription-promotions",
      deletedAt: null,
      status: mongoose.trusted({ $ne: "deleted" })
    }).sort({ createdAt: -1 });
    return records.map(serializePromotion);
  }

  public async createPromotion(actorId: string, input: PromotionBodyInput) {
    const record = await GeneratedApiRecordModel.create({
      resource: "subscription-promotions",
      scope: { key: input.code },
      data: input,
      status: "active",
      history: [
        this.history("admin.subscriptions.promotion-created", actorId, { code: input.code })
      ]
    });
    return serializePromotion(record);
  }

  public async updatePromotion(actorId: string, promotionId: string, input: PromotionBodyInput) {
    const record = await this.requirePromotion(promotionId);
    record.data = input;
    record.history.push(
      this.history("admin.subscriptions.promotion-updated", actorId, { promotionId })
    );
    await record.save();
    return serializePromotion(record);
  }

  public async setPromotionStatus(
    actorId: string,
    promotionId: string,
    status: "active" | "inactive"
  ) {
    const record = await this.requirePromotion(promotionId);
    record.status = status;
    record.history.push(
      this.history(`admin.subscriptions.promotion-${status}`, actorId, { promotionId })
    );
    await record.save();
    return serializePromotion(record);
  }

  public async deletePromotion(actorId: string, promotionId: string) {
    const record = await this.requirePromotion(promotionId);
    record.status = "deleted";
    record.deletedAt = new Date();
    record.history.push(
      this.history("admin.subscriptions.promotion-deleted", actorId, { promotionId })
    );
    await record.save();
    return { deleted: true };
  }

  public async recentActions() {
    const records = await GeneratedApiRecordModel.find({
      resource: mongoose.trusted({
        $in: ["subscription-plans", "subscription-settings", "subscription-promotions"]
      })
    })
      .sort({ updatedAt: -1 })
      .limit(30);
    const adminIds = new Set<string>();
    records.forEach((record) =>
      record.history.forEach((entry) => {
        if (entry.actorId) {
          adminIds.add(entry.actorId);
        }
      })
    );
    const admins = await AdminAccountModel.find({ _id: mongoose.trusted({ $in: [...adminIds] }) })
      .select("displayName email")
      .lean();
    const adminMap = new Map(
      admins.map((admin) => [admin._id.toString(), admin.displayName || admin.email])
    );

    return records
      .flatMap((record) =>
        record.history.map((entry, index) => ({
          id: `${record._id.toString()}:${index}`,
          plan: this.actionTargetName(record),
          admin: entry.actorId ? (adminMap.get(entry.actorId) ?? "Admin") : "System",
          action: this.actionLabel(entry.action),
          date: entry.at.toISOString(),
          dateLabel: new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }).format(entry.at),
          status: "Success"
        }))
      )
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 10);
  }

  private async ensureDefaultPlans(): Promise<void> {
    for (const plan of defaultPlans) {
      const exists = await GeneratedApiRecordModel.exists({
        resource: "subscription-plans",
        "scope.key": plan.id,
        deletedAt: null
      });
      if (!exists) {
        await GeneratedApiRecordModel.create({
          resource: "subscription-plans",
          scope: { key: plan.id },
          data: plan,
          status: "active",
          history: [this.history("admin.subscriptions.plan-seeded", undefined, { planId: plan.id })]
        });
      }
    }
  }

  private async requirePlan(planId: string): Promise<GeneratedApiRecordDocument> {
    await this.ensureDefaultPlans();
    const record = await GeneratedApiRecordModel.findOne({
      resource: "subscription-plans",
      "scope.key": planId,
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Subscription plan not found.");
    }
    return record;
  }

  private async requirePromotion(promotionId: string): Promise<GeneratedApiRecordDocument> {
    const identifier = mongoose.Types.ObjectId.isValid(promotionId)
      ? { _id: promotionId }
      : { "scope.key": promotionId };
    const record = await GeneratedApiRecordModel.findOne({
      ...identifier,
      resource: "subscription-promotions",
      deletedAt: null
    });
    if (!record) {
      throw new ResourceNotFoundError("Subscription promotion not found.");
    }
    return record;
  }

  private settingsRecord(): Promise<GeneratedApiRecordDocument | null> {
    return GeneratedApiRecordModel.findOne({
      resource: "subscription-settings",
      "scope.key": "global",
      deletedAt: null
    });
  }

  private history(action: string, actorId: string | undefined, metadata: Record<string, unknown>) {
    return {
      action,
      ...(actorId ? { actorId } : {}),
      actorType: actorId ? "admin" : "system",
      at: new Date(),
      metadata
    };
  }

  private actionTargetName(record: GeneratedApiRecordDocument): string {
    if (record.resource === "subscription-settings") {
      return "Global Settings";
    }
    return (
      stringValue(record.data.name) ||
      stringValue(record.data.code) ||
      stringValue(record.scope.key, "Subscription")
    );
  }

  private actionLabel(action: string): string {
    return action
      .replace(/^admin\.subscriptions\./, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
