import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { UserService } from "./users.service.js";
import type {
  ConfirmAvatarInput,
  UpdateDarkModeInput,
  UpdatePreferencesInput,
  UpdateProfileInput
} from "./users.validation.js";

const actorId = (req: Request): string => {
  if (!req.auth) {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class UserController {
  public constructor(private readonly service: UserService) {}

  public me = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getMe(actorId(req)));
  };

  public updateMe = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updateMe(actorId(req), req.body as UpdateProfileInput)
    );
  };

  public deleteMe = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.deleteMe(actorId(req)));
  };

  public activity = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getActivity(actorId(req)));
  };

  public stats = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getStats(actorId(req)));
  };

  public preferences = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getPreferences(actorId(req)));
  };

  public darkMode = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getDarkMode(actorId(req)));
  };

  public updateDarkMode = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updateDarkMode(actorId(req), req.body as UpdateDarkModeInput)
    );
  };

  public updatePreferences = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.updatePreferences(actorId(req), req.body as UpdatePreferencesInput)
    );
  };

  public avatarUploadUrl = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.createAvatarUploadUrl(actorId(req)));
  };

  public confirmAvatar = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.confirmAvatar(actorId(req), req.body as ConfirmAvatarInput)
    );
  };

  public deleteAvatar = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.deleteAvatar(actorId(req)));
  };
}
