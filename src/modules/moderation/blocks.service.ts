import { ConflictError, ResourceNotFoundError } from "../../common/errors/app-error.js";
import mongoose, { Types } from "mongoose";
import { CustomerAccountModel } from "../customer/auth/auth.model.js";
import { UserBlockModel } from "./blocks.model.js";

const asObjectId = (value: string): Types.ObjectId | string =>
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;

export const isBlockedEitherWay = async (userId: string, otherUserId: string): Promise<boolean> => {
  if (!userId || !otherUserId || userId === otherUserId) {
    return false;
  }
  const existing = await UserBlockModel.exists({
    $or: [
      { blockerId: userId, blockedId: otherUserId },
      { blockerId: otherUserId, blockedId: userId }
    ]
  });
  return Boolean(existing);
};

export class BlockService {
  public async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new ConflictError("You cannot block yourself.");
    }
    await this.requireCustomer(blockedId);
    const existing = await UserBlockModel.findOne({ blockerId, blockedId });
    if (existing) {
      return this.serialize(existing);
    }
    const created = await UserBlockModel.create({ blockerId, blockedId });
    return this.serialize(created);
  }

  public async unblock(blockerId: string, blockedId: string) {
    const deleted = await UserBlockModel.findOneAndDelete({ blockerId, blockedId });
    if (!deleted) {
      throw new ResourceNotFoundError("Block not found.");
    }
    return { unblocked: true, userId: blockedId };
  }

  public async list(blockerId: string) {
    const blocks = await UserBlockModel.find({ blockerId }).sort({ createdAt: -1 });
    const customers = blocks.length
      ? await CustomerAccountModel.find({
          _id: mongoose.trusted({ $in: blocks.map((block) => asObjectId(block.blockedId)) })
        })
          .select("displayName email avatarUrl")
          .lean()
      : [];
    const byId = new Map(customers.map((customer) => [customer._id.toString(), customer]));
    return {
      items: blocks.map((block) => {
        const user = byId.get(block.blockedId);
        return {
          ...this.serialize(block),
          user: user
            ? {
                id: user._id.toString(),
                displayName: user.displayName,
                email: user.email,
                avatarUrl: user.avatarUrl ?? null
              }
            : null
        };
      })
    };
  }

  public async status(viewerId: string, otherUserId: string) {
    const [blocked, blockedByThem] = await Promise.all([
      UserBlockModel.exists({ blockerId: viewerId, blockedId: otherUserId }),
      UserBlockModel.exists({ blockerId: otherUserId, blockedId: viewerId })
    ]);
    return {
      userId: otherUserId,
      blocked: Boolean(blocked),
      blockedByThem: Boolean(blockedByThem),
      blockedEitherWay: Boolean(blocked || blockedByThem)
    };
  }

  private async requireCustomer(customerId: string) {
    const customer = await CustomerAccountModel.findOne({
      _id: asObjectId(customerId),
      deletedAt: null
    })
      .select("_id")
      .lean();
    if (!customer) {
      throw new ResourceNotFoundError("User not found.");
    }
  }

  private serialize(block: { _id: { toString(): string }; blockerId: string; blockedId: string; createdAt: Date }) {
    return {
      id: block._id.toString(),
      blockerId: block.blockerId,
      blockedId: block.blockedId,
      createdAt: block.createdAt.toISOString()
    };
  }
}
