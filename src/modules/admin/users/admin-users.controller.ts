import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AdminUsersService } from "./admin-users.service.js";
import { adminUsersQuerySchema } from "./admin-users.validation.js";
import type {
  AdminUsersQueryInput,
  AdminUserStatusInput
} from "./admin-users.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

const userIdParam = (req: Request): string => {
  const userId = req.params.userId;
  if (!userId) {
    throw new AuthenticationError();
  }
  return userId;
};

export class AdminUsersController {
  public constructor(private readonly service: AdminUsersService) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const query: AdminUsersQueryInput = adminUsersQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.listUsers(query));
  };

  public summary = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.summary());
  };

  public get = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getUser(userIdParam(req)));
  };

  public status = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AdminUserStatusInput;
    sendSuccess(
      res,
      req.requestId,
      await this.service.setStatus(adminActorId(req), userIdParam(req), body.status)
    );
  };

  public suspend = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setStatus(adminActorId(req), userIdParam(req), "suspended")
    );
  };

  public unsuspend = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.setStatus(adminActorId(req), userIdParam(req), "active")
    );
  };
}
