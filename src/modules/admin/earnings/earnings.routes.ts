import { Router, type RequestHandler } from "express";
import { authenticate } from "../../../common/auth/authenticate.js";
import { AuthorizationError } from "../../../common/errors/app-error.js";
import { asyncHandler } from "../../../common/middleware/async-handler.js";
import { validate } from "../../../common/middleware/validate.js";
import { AdminEarningsController } from "./earnings.controller.js";
import { AdminEarningsService } from "./earnings.service.js";
import {
  earningsRefundParamsSchema,
  earningsTransactionParamsSchema,
  earningsTransactionsQuerySchema
} from "./earnings.validation.js";

export const createAdminEarningsRouter = (): Router => {
  const router = Router();
  const controller = new AdminEarningsController(new AdminEarningsService());
  const readEarningsPermissions = [
    "admin:earnings",
    "analytics.read",
    "subscriptions.read",
    "dashboard.read",
    "admin:dashboard"
  ];

  router.use(authenticate("admin"));
  router.get(
    "/summary",
    requireAnyPermission(...readEarningsPermissions),
    asyncHandler(controller.summary)
  );
  router.get(
    "/transactions",
    requireAnyPermission(...readEarningsPermissions),
    validate({ query: earningsTransactionsQuerySchema }),
    asyncHandler(controller.transactions)
  );
  router.get(
    "/transactions/export",
    requireAnyPermission(...readEarningsPermissions, "analytics.export"),
    validate({ query: earningsTransactionsQuerySchema }),
    asyncHandler(controller.exportTransactions)
  );
  router.get(
    "/transactions/:transactionId",
    requireAnyPermission(...readEarningsPermissions),
    validate({ params: earningsTransactionParamsSchema }),
    asyncHandler(controller.transaction)
  );
  router.get(
    "/refunds",
    requireAnyPermission(...readEarningsPermissions, "subscriptions.refund"),
    asyncHandler(controller.refunds)
  );
  router.post(
    "/refunds/:paymentId",
    requireAnyPermission("admin:earnings", "subscriptions.refund"),
    validate({ params: earningsRefundParamsSchema }),
    asyncHandler(controller.createRefund)
  );
  router.get(
    "/subscription-revenue",
    requireAnyPermission(...readEarningsPermissions),
    asyncHandler(controller.subscriptionRevenue)
  );
  router.get(
    "/marketplace-fees",
    requireAnyPermission(...readEarningsPermissions),
    asyncHandler(controller.marketplaceFees)
  );

  return router;
};

const requireAnyPermission =
  (...permissions: string[]): RequestHandler =>
  (req, _res, next) => {
    const hasPermission = permissions.some((permission) =>
      req.auth?.permissions.includes(permission)
    );
    if (!hasPermission) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
