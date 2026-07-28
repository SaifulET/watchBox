import type { Response } from "express";
import type { ApiMeta, ApiSuccess } from "../types/api-response.js";

export const buildMeta = (requestId: string): ApiMeta => ({
  requestId,
  generatedAt: new Date().toISOString()
});

export const sendSuccess = <TData>(
  res: Response,
  requestId: string,
  data: TData,
  status = 200
): void => {
  const response: ApiSuccess<TData> = {
    success: true,
    data,
    meta: buildMeta(requestId)
  };
  res.status(status).json(response);
};
