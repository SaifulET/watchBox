import mongoose, { type UpdateQuery } from "mongoose";
import {
  AccountTokenModel,
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

  public deleteById(userId: string): Promise<CustomerAccountDocument | null> {
    return CustomerAccountModel.findOneAndDelete({ _id: userId, deletedAt: null });
  }

  public async listSessionIds(userId: string): Promise<string[]> {
    const sessions = await AuthSessionModel.find({ accountKind: "customer", accountId: userId }).select(
      "_id"
    );
    return sessions.map((session) => session._id.toString());
  }

  public async deleteSessions(userId: string): Promise<void> {
    await AuthSessionModel.deleteMany({ accountKind: "customer", accountId: userId });
  }

  public async deleteAccountTokens(userId: string): Promise<void> {
    await AccountTokenModel.deleteMany({ accountKind: "customer", accountId: userId });
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
