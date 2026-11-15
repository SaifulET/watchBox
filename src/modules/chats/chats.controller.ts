import type { Request, Response } from "express";
import { AuthenticationError } from "../../common/errors/app-error.js";
import { messageAttachmentFiles } from "../../common/middleware/message-attachment-upload.js";
import { sendSuccess } from "../../common/utils/api-response.js";
import type { ChatService } from "./chats.service.js";
import {
  chatListQuerySchema,
  chatMessageBodySchema,
  type AdminOpenChatBodyInput,
  type ChatMessageBodyInput,
  type OpenChatBodyInput
} from "./chats.validation.js";

const actorId = (req: Request, audience: "customer" | "admin"): string => {
  if (!req.auth || req.auth.audience !== audience) {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class ChatController {
  public constructor(private readonly service: ChatService) {}

  public listMine = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.listForCustomer(actorId(req, "customer"), chatListQuerySchema.parse(req.query))
    );
  };

  public getMine = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.getForCustomer(actorId(req, "customer"), req.params.chatId ?? "")
    );
  };

  public openMine = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.openForCustomer(
        actorId(req, "customer"),
        req.body as OpenChatBodyInput,
        messageAttachmentFiles(req)
      ),
      201
    );
  };

  public contactSeller = async (req: Request, res: Response): Promise<void> => {
    const body = chatMessageBodySchema.parse(req.body ?? {});
    sendSuccess(
      res,
      req.requestId,
      await this.service.contactSeller(
        actorId(req, "customer"),
        req.params.listingId ?? "",
        body.message,
        messageAttachmentFiles(req)
      ),
      201
    );
  };

  public sendMine = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.sendCustomerMessage(
        actorId(req, "customer"),
        req.params.chatId ?? "",
        (req.body as ChatMessageBodyInput).message,
        messageAttachmentFiles(req)
      )
    );
  };

  public listAdmin = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.listForAdmin(chatListQuerySchema.parse(req.query))
    );
  };

  public getAdmin = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.getForAdmin(req.params.chatId ?? ""));
  };

  public openAdmin = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.openForAdmin(
        actorId(req, "admin"),
        req.body as AdminOpenChatBodyInput,
        messageAttachmentFiles(req)
      ),
      201
    );
  };

  public sendAdmin = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.sendAdminMessage(
        actorId(req, "admin"),
        req.params.chatId ?? "",
        (req.body as ChatMessageBodyInput).message,
        messageAttachmentFiles(req)
      )
    );
  };
}
