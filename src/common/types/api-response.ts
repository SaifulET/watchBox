export type ApiMeta = {
  requestId: string;
  generatedAt?: string;
};

export type ApiSuccess<TData> = {
  success: true;
  data: TData;
  meta: ApiMeta;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
  meta: ApiMeta;
};
