import mongoose, { type FilterQuery, type UpdateQuery } from "mongoose";
import {
  AuthSessionModel,
  CustomerAccountModel,
  type CustomerAccount,
  type CustomerAccountDocument
} from "../../customer/auth/auth.model.js";
import { GeneratedApiRecordModel } from "../../generated-api/generated-api.model.js";

export type CustomerSubscriptionSnapshot = {
  ownerId?: string;
  status: string;
  data: Record<string, unknown>;
};

export class AdminUsersRepository {
  public listCustomers(filter: FilterQuery<CustomerAccount>) {
    return CustomerAccountModel.find(filter).sort({ createdAt: -1 });
  }

  public countCustomers(filter: FilterQuery<CustomerAccount>): Promise<number> {
    return CustomerAccountModel.countDocuments(filter);
  }

  public findCustomerById(userId: string): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findOne({ _id: userId, deletedAt: null });
  }

  public updateCustomerById(
    userId: string,
    update: UpdateQuery<CustomerAccount>
  ): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findOneAndUpdate({ _id: userId, deletedAt: null }, update, {
      new: true
    });
  }

  public async revokeCustomerSessions(userId: string): Promise<void> {
    await AuthSessionModel.updateMany(
      {
        accountKind: "customer",
        accountId: userId,
        revokedAt: null,
        expiresAt: mongoose.trusted({ $gt: new Date() })
      },
      { $set: { revokedAt: new Date() } }
    );
  }

  public countActiveCustomerSessions(userId: string): Promise<number> {
    return AuthSessionModel.countDocuments({
      accountKind: "customer",
      accountId: userId,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
  }

  public async listSubscriptionSnapshots(userIds: string[]): Promise<CustomerSubscriptionSnapshot[]> {
    if (userIds.length === 0) {
      return [];
    }
    return GeneratedApiRecordModel.find({
      resource: "customer-subscriptions",
      ownerId: mongoose.trusted({ $in: userIds }),
      "scope.kind": "current",
      deletedAt: null
    })
      .select("ownerId data status")
      .lean<CustomerSubscriptionSnapshot[]>();
  }
}
