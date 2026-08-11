import type { Request, Response } from "express";
import { AuthenticationError } from "../../../common/errors/app-error.js";
import { sendSuccess } from "../../../common/utils/api-response.js";
import type { AdminEarningsService } from "./earnings.service.js";
import { earningsTransactionsQuerySchema } from "./earnings.validation.js";

const adminActorId = (req: Request): string => {
  if (!req.auth || req.auth.audience !== "admin") {
    throw new AuthenticationError();
  }
  return req.auth.id;
};

export class AdminEarningsController {
  public constructor(private readonly service: AdminEarningsService) {}

  public summary = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.summary());
  };

  public transactions = async (req: Request, res: Response): Promise<void> => {
    const query = earningsTransactionsQuerySchema.parse(req.query);
    sendSuccess(res, req.requestId, await this.service.listTransactions(query));
  };

  public exportTransactions = async (req: Request, res: Response): Promise<void> => {
    const query = earningsTransactionsQuerySchema.parse(req.query);
    const csv = await this.service.exportTransactions(query);
    res
      .status(200)
      .setHeader("Content-Type", "text/csv; charset=utf-8")
      .setHeader("Content-Disposition", 'attachment; filename="earnings-transactions.csv"')
      .send(csv);
  };

  public transaction = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.getTransaction(req.params.transactionId ?? "")
    );
  };

  public refunds = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.refunds());
  };

  public createRefund = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(
      res,
      req.requestId,
      await this.service.createRefund(adminActorId(req), req.params.paymentId ?? ""),
      201
    );
  };

  public subscriptionRevenue = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.subscriptionRevenue());
  };

  public marketplaceFees = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.requestId, await this.service.marketplaceFees());
  };
}
