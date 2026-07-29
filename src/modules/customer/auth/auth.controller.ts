import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type {
  AdminMfaChallengeInput,
  AdminMfaVerifyInput,
  AdminVerifyResetCodeInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  SessionParamsInput,
  VerifyEmailConfirmInput,
  VerifyEmailRequestInput
} from "./auth.validation.js";
import type { AdminAuthService, CustomerAuthService } from "./auth.service.js";

const fingerprintFromRequest = (req: Request) => {
  const result: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) {
    result.ipAddress = req.ip;
  }
  const userAgent = req.header("user-agent");
  if (userAgent) {
    result.userAgent = userAgent;
  }
  return result;
};

const requireAuth = (req: Request) => {
  if (!req.auth) {
    throw new AuthenticationError();
  }
  return req.auth;
};

export class CustomerAuthController {
  public constructor(private readonly service: CustomerAuthService) {}

  public register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.register(req.body as RegisterInput, fingerprintFromRequest(req));
    res.once("finish", () => {
      void this.service
        .sendRegistrationEmailVerification(result.emailVerification)
        .catch((error: unknown) => {
          req.log?.error(
            { err: error, requestId: req.requestId, accountId: result.emailVerification.accountId },
            "Failed to send registration email verification"
          );
        });
    });
    sendSuccess(res, req.requestId, result.auth, 201);
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body as LoginInput, fingerprintFromRequest(req));
    sendSuccess(res, req.requestId, result);
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.refresh(req.body as RefreshInput);
    sendSuccess(res, req.requestId, result);
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.logout(actor.sessionId);
    sendSuccess(res, req.requestId, result);
  };

  public logoutAll = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.logoutAll(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public requestEmailVerification = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.requestEmailVerification(req.body as VerifyEmailRequestInput);
    sendSuccess(res, req.requestId, result);
  };

  public confirmEmail = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.confirmEmail(req.body as VerifyEmailConfirmInput);
    sendSuccess(res, req.requestId, result);
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.forgotPassword(
      req.body as ForgotPasswordInput,
      fingerprintFromRequest(req)
    );
    sendSuccess(res, req.requestId, result);
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.resetPassword(req.body as ResetPasswordInput);
    sendSuccess(res, req.requestId, result);
  };

  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.changePassword(actor.id, req.body as ChangePasswordInput);
    sendSuccess(res, req.requestId, result);
  };

  public sessions = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.listSessions(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public revokeSession = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const params = req.params as SessionParamsInput;
    const result = await this.service.revokeOwnSession(actor.id, params.sessionId);
    sendSuccess(res, req.requestId, result);
  };
}

export class AdminAuthController {
  public constructor(private readonly service: AdminAuthService) {}

  public login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.login(req.body as LoginInput, fingerprintFromRequest(req));
    sendSuccess(res, req.requestId, result);
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.refresh(req.body as RefreshInput);
    sendSuccess(res, req.requestId, result);
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.logout(actor.sessionId);
    sendSuccess(res, req.requestId, result);
  };

  public logoutAll = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.logoutAll(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.forgotPassword(
      req.body as ForgotPasswordInput,
      fingerprintFromRequest(req)
    );
    sendSuccess(res, req.requestId, result);
  };

  public verifyResetCode = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.verifyResetCode(req.body as AdminVerifyResetCodeInput);
    sendSuccess(res, req.requestId, result);
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.resetPassword(req.body as ResetPasswordInput);
    sendSuccess(res, req.requestId, result);
  };

  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.changePassword(actor.id, req.body as ChangePasswordInput);
    sendSuccess(res, req.requestId, result);
  };

  public sessions = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.listSessions(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public revokeSession = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const params = req.params as SessionParamsInput;
    const result = await this.service.revokeOwnSession(actor.id, params.sessionId);
    sendSuccess(res, req.requestId, result);
  };

  public setupMfa = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.setupMfa(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public verifyMfa = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.verifyMfa(actor.id, req.body as AdminMfaVerifyInput);
    sendSuccess(res, req.requestId, result);
  };

  public challengeMfa = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.challengeMfa(req.body as AdminMfaChallengeInput);
    sendSuccess(res, req.requestId, result);
  };

  public disableMfa = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.disableMfa(actor.id);
    sendSuccess(res, req.requestId, result);
  };

  public permissions = async (req: Request, res: Response): Promise<void> => {
    const actor = requireAuth(req);
    const result = await this.service.getPermissions(actor.id);
    sendSuccess(res, req.requestId, result);
  };
}
