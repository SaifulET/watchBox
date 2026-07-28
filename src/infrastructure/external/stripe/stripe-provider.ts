export type CheckoutSessionRequest = {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  id: string;
  url: string;
};

export interface PaymentProvider {
  createCheckoutSession(payload: CheckoutSessionRequest): Promise<CheckoutSession>;
}

export class LocalPaymentProvider implements PaymentProvider {
  public createCheckoutSession(payload: CheckoutSessionRequest): Promise<CheckoutSession> {
    return Promise.resolve({
      id: `local_${payload.customerId}_${payload.priceId}`,
      url: payload.successUrl
    });
  }
}
