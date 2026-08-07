import { ConflictError, ExternalServiceError } from "../../../common/errors/app-error.js";
import { getPaymentConfig } from "../../../config/payment.config.js";

export type CheckoutSessionRequest = {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string;
  metadata?: Record<string, string>;
};

export type CheckoutSession = {
  id: string;
  url: string;
};

export type StripeCustomer = {
  id: string;
};

export type BillingPortalSession = {
  id: string;
  url: string;
};

export interface PaymentProvider {
  createCheckoutSession(payload: CheckoutSessionRequest): Promise<CheckoutSession>;
  createCustomer(payload: { email: string; name: string; metadata?: Record<string, string> }): Promise<StripeCustomer>;
  createBillingPortalSession(payload: { customerId: string; returnUrl: string }): Promise<BillingPortalSession>;
}

export class LocalPaymentProvider implements PaymentProvider {
  public createCustomer(payload: { email: string; name: string }): Promise<StripeCustomer> {
    return Promise.resolve({
      id: `local_customer_${payload.email}_${payload.name}`.replace(/[^a-zA-Z0-9_]+/g, "_")
    });
  }

  public createCheckoutSession(payload: CheckoutSessionRequest): Promise<CheckoutSession> {
    return Promise.resolve({
      id: `local_${payload.customerId}_${payload.priceId}`,
      url: payload.successUrl
    });
  }

  public createBillingPortalSession(payload: { customerId: string; returnUrl: string }): Promise<BillingPortalSession> {
    return Promise.resolve({
      id: `local_portal_${payload.customerId}`,
      url: payload.returnUrl
    });
  }
}

type StripeResponse<T> = T & {
  error?: {
    message?: string;
  };
};

export class StripePaymentProvider implements PaymentProvider {
  private readonly baseUrl = "https://api.stripe.com/v1";

  public async createCustomer(payload: { email: string; name: string; metadata?: Record<string, string> }): Promise<StripeCustomer> {
    const response = await this.request<StripeCustomer>("customers", {
      email: payload.email,
      name: payload.name,
      ...this.metadataParams(payload.metadata)
    });
    return { id: response.id };
  }

  public async createCheckoutSession(payload: CheckoutSessionRequest): Promise<CheckoutSession> {
    const response = await this.request<CheckoutSession>("checkout/sessions", {
      mode: "subscription",
      customer: payload.customerId,
      client_reference_id: payload.clientReferenceId,
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
      "line_items[0][price]": payload.priceId,
      "line_items[0][quantity]": "1",
      ...this.metadataParams(payload.metadata),
      ...this.subscriptionMetadataParams(payload.metadata)
    });
    if (!response.url) {
      throw new ExternalServiceError("Stripe checkout session did not include a URL.");
    }
    return {
      id: response.id,
      url: response.url
    };
  }

  public async createBillingPortalSession(payload: { customerId: string; returnUrl: string }): Promise<BillingPortalSession> {
    const response = await this.request<BillingPortalSession>("billing_portal/sessions", {
      customer: payload.customerId,
      return_url: payload.returnUrl
    });
    if (!response.url) {
      throw new ExternalServiceError("Stripe billing portal session did not include a URL.");
    }
    return {
      id: response.id,
      url: response.url
    };
  }

  private async request<T extends { id: string }>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const config = getPaymentConfig();
    if (!config.stripeSecretKey) {
      throw new ConflictError("Stripe secret key is required.");
    }
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body.set(key, value);
      }
    }
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const payload = (await response.json()) as StripeResponse<T>;
    if (!response.ok) {
      throw new ExternalServiceError(payload.error?.message ?? `Stripe request failed with status ${response.status}.`);
    }
    return payload;
  }

  private metadataParams(metadata: Record<string, string> | undefined): Record<string, string> {
    return Object.fromEntries(Object.entries(metadata ?? {}).map(([key, value]) => [`metadata[${key}]`, value]));
  }

  private subscriptionMetadataParams(metadata: Record<string, string> | undefined): Record<string, string> {
    return Object.fromEntries(Object.entries(metadata ?? {}).map(([key, value]) => [`subscription_data[metadata][${key}]`, value]));
  }
}
