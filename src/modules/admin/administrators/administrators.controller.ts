import type { Request, Response } from "express";
import { fromZodError } from "../../../common/errors/error-handler.js";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AdministratorsService } from "./administrators.service.js";
import { createAdministratorSchema } from "./administrators.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class AdministratorsController {
  public constructor(private readonly service: AdministratorsService) {}

  public roles = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    sendSuccess(res, req.requestId, await Promise.resolve(this.service.listRoles()));
  };

  public permissions = async (req: Request, res: Response): Promise<void> => {
    adminActorId(req);
    sendSuccess(res, req.requestId, await Promise.resolve(this.service.listPermissions()));
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const parsed = createAdministratorSchema.safeParse(req.body);
    if (!parsed.success) {
      throw fromZodError(parsed.error);
    }

    sendSuccess(
      res,
      req.requestId,
      await this.service.createAdministrator(
        adminActorId(req),
        parsed.data,
        req.file
      ),
      201
    );
  };
}
