import mongoose, { type UpdateQuery } from "mongoose";
import {
  AuthSessionModel,
  CustomerAccountModel,
  type CustomerAccount,
  type CustomerAccountDocument
} from "../auth/auth.model.js";

export class UserRepository {
  public findById(userId: string): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findOne({ _id: userId, deletedAt: null });
  }

  public updateById(
    userId: string,
    update: UpdateQuery<CustomerAccount>
  ): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findByIdAndUpdate(userId, update, { new: true });
  }

  public async softDelete(userId: string): Promise<void> {
    await CustomerAccountModel.updateOne(
      { _id: userId, deletedAt: null },
      { $set: { status: "deleted", deletedAt: new Date() } }
    );
  }

  public countActiveSessions(userId: string): Promise<number> {
    return AuthSessionModel.countDocuments({
      accountKind: "customer",
      accountId: userId,
      revokedAt: null,
      expiresAt: mongoose.trusted({ $gt: new Date() })
    });
  }

  public listRecentSessions(userId: string, limit: number) {
    return AuthSessionModel.find({
      accountKind: "customer",
      accountId: userId
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  public async countOwnedDocuments(collectionName: string, userId: string): Promise<number> {
    if (!mongoose.connection.db) {
      return 0;
    }
    return mongoose.connection.db.collection(collectionName).countDocuments({
      $or: [{ userId }, { ownerId: userId }, { customerId: userId }, { sellerId: userId }]
    });
  }
}
