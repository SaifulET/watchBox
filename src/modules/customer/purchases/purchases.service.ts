import { createHash } from "node:crypto";
import { Types } from "mongoose";
import {
  AuthorizationError,
  ConflictError,
  ResourceNotFoundError
} from "../../../common/errors/app-error.js";
import { getPaymentConfig } from "../../../config/payment.config.js";
import {
  LocalPaymentProvider,
  StripePaymentProvider,
  type PaymentIntent,
  type PaymentProvider
} from "../../../infrastructure/external/stripe/stripe-provider.js";
import { CustomerAccountModel } from "../auth/auth.model.js";
import {
  GeneratedApiRecordModel,
  type GeneratedApiRecordDocument
} from "../../generated-api/generated-api.model.js";
import type {
  ConfirmPaymentInput,
  CreateOrderInput,
  CreateProductPaymentIntentInput
} from "./purchases.validation.js";

type SerializedPurchaseRecord = {
  id: string;
  resource: string;
  ownerId: string | null;
  scope: Record<string, string>;
  data: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ProductPaymentCreateInput = {
  userId: string;
  sellerId: string;
  buyer: {
    email: string;
    displayName: string;
  };
  seller: {
    displayName: string;
  };
  listingId: string;
  quantity: number;
  total: number;
  currency: string;
  snapshot: Record<string, unknown>;
  idempotencyKey: string;
};

const paidOrderStatuses = new Set(["paid", "processing", "shipped", "delivered", "completed"]);
const unavailableListingStatuses = new Set(["sold", "reserved", "deleted", "inactive", "archived"]);
const reusablePaymentIntentStatuses = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "succeeded"
]);
const reusableProductPaymentStatuses = new Set(["pending_payment", "requires_payment_method", "requires_action", "processing"]);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const numberValue = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const idempotencyKey = (...parts: string[]): string =>
  createHash("sha256").update(parts.join(":")).digest("hex");

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === 11000;

const listingImage = (data: Record<string, unknown>): string | null => {
  if (typeof data.image === "string") {
    return data.image;
  }
  if (!Array.isArray(data.images)) {
    return null;
  }
  for (const image of data.images) {
    if (typeof image === "string") {
      return image;
    }
    if (typeof image === "object" && image !== null) {
      const url = (image as Record<string, unknown>).url;
      if (typeof url === "string") {
        return url;
      }
    }
  }
  return null;
};

const serializeRecord = (record: GeneratedApiRecordDocument): SerializedPurchaseRecord => ({
  id: record._id.toString(),
  resource: record.resource,
  ownerId: record.ownerId ?? null,
  scope: record.scope,
  data: record.data,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString()
});

export class PurchasesService {
  private readonly payments: PaymentProvider;

  public constructor(paymentProvider?: PaymentProvider) {
    this.payments =
      paymentProvider ??
      (getPaymentConfig().stripeSecretKey
        ? new StripePaymentProvider()
        : new LocalPaymentProvider());
  }

  public paymentConfig() {
    const config = getPaymentConfig();
    return {
      provider: config.stripeSecretKey ? "stripe" : "local",
      stripePublishableKey: config.stripePublishableKey ?? null,
      paymentFlow: "payment_intent",
      confirmation: config.stripeSecretKey ? "stripe_js_and_webhook" : "local_confirm_endpoint"
    };
  }

  public async productPaymentStatus(userId: string, productId: string) {
    const listing = await this.requireListing(productId);
    const productPayment = await GeneratedApiRecordModel.findOne({
      resource: "product-payments",
      ownerId: userId,
      deletedAt: null,
      "scope.listingId": listing._id.toString()
    }).sort({ createdAt: -1 });
    const purchaseId = productPayment?._id.toString() ?? null;
    const paymentRecord = purchaseId
      ? await GeneratedApiRecordModel.findOne({
          resource: "payment-intent",
          ownerId: userId,
          deletedAt: null,
          "scope.purchaseId": purchaseId
        }).sort({ createdAt: -1 })
      : null;

    return {
      productId: listing._id.toString(),
      productStatus: listing.status,
      listingStatus: stringValue(listing.data.listingStatus) ?? null,
      purchaseStatus: stringValue(listing.data.purchaseStatus) ?? null,
      purchaseId,
      paymentStatus:
        stringValue(productPayment?.data.paymentStatus) ??
        stringValue(paymentRecord?.data.status) ??
        productPayment?.status ??
        paymentRecord?.status ??
        null,
      paymentIntentId:
        stringValue(productPayment?.data.paymentIntentId) ??
        stringValue(paymentRecord?.data.paymentIntentId) ??
        null,
      paymentProvider:
        stringValue(productPayment?.data.paymentProvider) ??
        stringValue(paymentRecord?.data.provider) ??
        null,
      fulfillmentStatus: stringValue(productPayment?.data.fulfillmentStatus) ?? null,
      amount:
        numberValue(productPayment?.data.total) ??
        numberValue(paymentRecord?.data.amount) ??
        null,
      currency:
        stringValue(productPayment?.data.currency)?.toUpperCase() ??
        stringValue(paymentRecord?.data.currency)?.toUpperCase() ??
        null,
      paidAt: stringValue(productPayment?.data.paidAt) ?? null,
      updatedAt: productPayment?.updatedAt.toISOString() ?? listing.updatedAt.toISOString()
    };
  }

  public async createOrder(userId: string, input: CreateOrderInput) {
    const listing = await this.requirePurchasableListing(input.listingId, userId);
    const price = numberValue(listing.data.price);
    if (!price || price <= 0) {
      throw new ConflictError("Listing does not have a valid purchase price.");
    }

    const quantity = input.quantity;
    const currency = (stringValue(listing.data.currency) ?? "USD").toUpperCase();
    const sellerId = listing.ownerId;
    if (!sellerId) {
      throw new ConflictError("Listing does not have a seller.");
    }
    const buyer = await this.requireCustomer(userId);
    const seller = await this.requireCustomer(sellerId);
    const total = Number((price * quantity).toFixed(2));
    const snapshot = {
      id: listing._id.toString(),
      title: stringValue(listing.data.title) ?? "Internal product",
      brand: stringValue(listing.data.brand) ?? null,
      model: stringValue(listing.data.model) ?? null,
      referenceNumber: stringValue(listing.data.referenceNumber) ?? null,
      image: listingImage(listing.data),
      price,
      currency
    };
    const orderIdempotencyKey = idempotencyKey("order", userId, listing._id.toString(), String(quantity));

    const existingPendingOrder = await GeneratedApiRecordModel.findOne({
      resource: "orders",
      ownerId: userId,
      deletedAt: null,
      "scope.idempotencyKey": orderIdempotencyKey
    });
    if (existingPendingOrder) {
      return { order: serializeRecord(existingPendingOrder), reused: true };
    }

    try {
      const order = await GeneratedApiRecordModel.create({
        resource: "orders",
        ownerId: userId,
        scope: { listingId: listing._id.toString(), idempotencyKey: orderIdempotencyKey },
        data: {
          listingId: listing._id.toString(),
          buyerId: userId,
          sellerId,
          buyer: {
            id: userId,
            displayName: buyer.displayName,
            email: buyer.email
          },
          seller: {
            id: sellerId,
            displayName: seller.displayName
          },
          listing: snapshot,
          title: snapshot.title,
          quantity,
          subtotal: total,
          total,
          currency,
          paymentStatus: "requires_payment",
          fulfillmentStatus: "pending"
        },
        status: "pending_payment",
        history: [
          {
            action: "orders.created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              listingId: listing._id.toString(),
              total,
              currency,
              idempotencyKey: orderIdempotencyKey
            }
          }
        ]
      });

      return { order: serializeRecord(order), reused: false };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const order = await GeneratedApiRecordModel.findOne({
        resource: "orders",
        ownerId: userId,
        deletedAt: null,
        "scope.idempotencyKey": orderIdempotencyKey
      });
      if (!order) {
        throw error;
      }
      return { order: serializeRecord(order), reused: true };
    }
  }

  public async createProductPaymentIntent(
    userId: string,
    productId: string,
    input: CreateProductPaymentIntentInput
  ) {
    const listing = await this.requirePurchasableListing(productId, userId);
    const price = numberValue(listing.data.price);
    if (!price || price <= 0) {
      throw new ConflictError("Product does not have a valid purchase price.");
    }
    const sellerId = listing.ownerId;
    if (!sellerId) {
      throw new ConflictError("Product does not have a seller.");
    }

    const quantity = input.quantity;
    const currency = (stringValue(listing.data.currency) ?? "USD").toUpperCase();
    const buyer = await this.requireCustomer(userId);
    const seller = await this.requireCustomer(sellerId);
    const total = Number((price * quantity).toFixed(2));
    const amountMinor = Math.round(total * 100);
    const productIdValue = listing._id.toString();
    const productPaymentIdempotencyKey = idempotencyKey(
      "product-payment",
      userId,
      productIdValue,
      String(quantity),
      String(amountMinor),
      currency.toLowerCase()
    );
    const paymentIdempotencyKey = idempotencyKey(
      "product-payment-intent",
      userId,
      productIdValue,
      String(quantity),
      String(amountMinor),
      currency.toLowerCase()
    );

    const snapshot = {
      id: productIdValue,
      title: stringValue(listing.data.title) ?? "Internal product",
      brand: stringValue(listing.data.brand) ?? null,
      model: stringValue(listing.data.model) ?? null,
      referenceNumber: stringValue(listing.data.referenceNumber) ?? null,
      image: listingImage(listing.data),
      price,
      currency
    };
    const productPayment = await this.findOrCreateProductPayment({
      userId,
      sellerId,
      buyer,
      seller,
      listingId: productIdValue,
      quantity,
      total,
      currency,
      snapshot,
      idempotencyKey: productPaymentIdempotencyKey
    });

    const reusablePaymentRecord = await this.reusableProductPaymentIntentRecord(
      userId,
      productPayment.id,
      paymentIdempotencyKey
    );
    if (reusablePaymentRecord) {
      return {
        productPayment,
        paymentIntent: this.publicPaymentIntentFromRecord(reusablePaymentRecord),
        paymentRecord: serializeRecord(reusablePaymentRecord),
        reused: true
      };
    }

    const paymentIntent = await this.payments.createPaymentIntent({
      amount: amountMinor,
      currency,
      description: `Internal product payment ${productPayment.id}`,
      idempotencyKey: paymentIdempotencyKey,
      receiptEmail: buyer.email,
      metadata: {
        purchaseId: productPayment.id,
        buyerId: userId,
        sellerId,
        listingId: productIdValue
      }
    });
    const provider = paymentIntent.id.startsWith("local_") ? "local" : "stripe";

    let paymentRecord: GeneratedApiRecordDocument;
    try {
      paymentRecord = await GeneratedApiRecordModel.create({
        resource: "payment-intent",
        ownerId: userId,
        scope: {
          purchaseId: productPayment.id,
          listingId: productIdValue,
          paymentIntentId: paymentIntent.id,
          idempotencyKey: paymentIdempotencyKey
        },
        data: {
          purchaseId: productPayment.id,
          listingId: productIdValue,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          provider,
          amount: total,
          amountMinor,
          currency,
          status: paymentIntent.status
        },
        status: paymentIntent.status,
        history: [
          {
            action: "payment-intent.created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              purchaseId: productPayment.id,
              listingId: productIdValue,
              paymentIntentId: paymentIntent.id,
              idempotencyKey: paymentIdempotencyKey
            }
          }
        ]
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const existingPaymentRecord = await this.reusableProductPaymentIntentRecord(
        userId,
        productPayment.id,
        paymentIdempotencyKey
      );
      if (!existingPaymentRecord) {
        throw error;
      }
      paymentRecord = existingPaymentRecord;
    }

    const updatedProductPayment = await GeneratedApiRecordModel.findByIdAndUpdate(
      productPayment.id,
      {
        $set: {
          status: paymentIntent.status,
          "data.paymentIntentId": paymentIntent.id,
          "data.paymentProvider": provider,
          "data.paymentStatus": paymentIntent.status,
          "data.clientSecret": paymentIntent.clientSecret,
          "data.paymentIdempotencyKey": paymentIdempotencyKey
        },
        $push: {
          history: {
            action: "product-payments.payment-intent-created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: { paymentIntentId: paymentIntent.id }
          }
        }
      },
      { new: true }
    );

    return {
      productPayment: updatedProductPayment ? serializeRecord(updatedProductPayment) : productPayment,
      paymentIntent: this.publicPaymentIntent(paymentIntent, total),
      paymentRecord: serializeRecord(paymentRecord),
      reused: false
    };
  }

  public async createPaymentIntent(userId: string, orderId: string) {
    const order = await this.requireOwnedOrder(userId, orderId);
    if (paidOrderStatuses.has(order.status)) {
      throw new ConflictError("Order is already paid.");
    }
    const total = numberValue(order.data.total);
    const currency = stringValue(order.data.currency);
    if (!total || total <= 0 || !currency) {
      throw new ConflictError("Order does not have a valid payable amount.");
    }

    const buyer = await this.requireCustomer(userId);
    const amountMinor = Math.round(total * 100);
    const paymentIdempotencyKey = idempotencyKey(
      "payment-intent",
      userId,
      order._id.toString(),
      String(amountMinor),
      currency.toLowerCase()
    );
    const reusablePaymentRecord = await this.reusablePaymentIntentRecord(
      userId,
      order._id.toString(),
      paymentIdempotencyKey
    );
    if (reusablePaymentRecord) {
      return {
        order: serializeRecord(order),
        paymentIntent: this.publicPaymentIntentFromRecord(reusablePaymentRecord),
        paymentRecord: serializeRecord(reusablePaymentRecord),
        reused: true
      };
    }

    const paymentIntent = await this.payments.createPaymentIntent({
      amount: amountMinor,
      currency,
      description: `Internal product order ${order._id.toString()}`,
      idempotencyKey: paymentIdempotencyKey,
      receiptEmail: buyer.email,
      metadata: {
        orderId: order._id.toString(),
        buyerId: userId,
        listingId: stringValue(order.data.listingId) ?? ""
      }
    });
    const provider = paymentIntent.id.startsWith("local_") ? "local" : "stripe";

    let paymentRecord: GeneratedApiRecordDocument;
    try {
      paymentRecord = await GeneratedApiRecordModel.create({
        resource: "payment-intent",
        ownerId: userId,
        scope: {
          orderId: order._id.toString(),
          paymentIntentId: paymentIntent.id,
          idempotencyKey: paymentIdempotencyKey
        },
        data: {
          orderId: order._id.toString(),
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.clientSecret,
          provider,
          amount: total,
          amountMinor,
          currency: currency.toUpperCase(),
          status: paymentIntent.status
        },
        status: paymentIntent.status,
        history: [
          {
            action: "payment-intent.created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              orderId: order._id.toString(),
              paymentIntentId: paymentIntent.id,
              idempotencyKey: paymentIdempotencyKey
            }
          }
        ]
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const existingPaymentRecord = await this.reusablePaymentIntentRecord(
        userId,
        order._id.toString(),
        paymentIdempotencyKey
      );
      if (!existingPaymentRecord) {
        throw error;
      }
      paymentRecord = existingPaymentRecord;
    }

    const updatedOrder = await GeneratedApiRecordModel.findByIdAndUpdate(
      order._id,
      {
        $set: {
          "data.paymentIntentId": paymentIntent.id,
          "data.paymentProvider": provider,
          "data.paymentStatus": paymentIntent.status,
          "data.clientSecret": paymentIntent.clientSecret,
          "data.paymentIdempotencyKey": paymentIdempotencyKey
        },
        $push: {
          history: {
            action: "orders.payment-intent-created",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: { paymentIntentId: paymentIntent.id }
          }
        }
      },
      { new: true }
    );

    return {
      order: serializeRecord(updatedOrder ?? order),
      paymentIntent: this.publicPaymentIntent(paymentIntent, total),
      paymentRecord: serializeRecord(paymentRecord),
      reused: false
    };
  }

  public async confirmPayment(userId: string, orderId: string, input: ConfirmPaymentInput) {
    const order = await this.requireOwnedOrder(userId, orderId);
    const paymentIntentId =
      input.paymentIntentId ?? stringValue(order.data.paymentIntentId);
    if (!paymentIntentId) {
      throw new ConflictError("Create a payment intent before confirming payment.");
    }
    if (stringValue(order.data.paymentProvider) === "stripe") {
      throw new ConflictError("Stripe card payments are confirmed by Stripe webhook after the frontend confirms the card.");
    }
    const listingId = stringValue(order.data.listingId);
    if (!listingId) {
      throw new ConflictError("Order does not reference a listing.");
    }

    await GeneratedApiRecordModel.findOneAndUpdate(
      {
        resource: "payment-intent",
        ownerId: userId,
        deletedAt: null,
        "scope.paymentIntentId": paymentIntentId
      },
      {
        $set: {
          status: "succeeded",
          "data.status": "succeeded"
        },
        $push: {
          history: {
            action: "payment-intent.succeeded",
            actorId: userId,
            actorType: "customer",
            at: new Date(),
            metadata: { orderId, paymentIntentId }
          }
        }
      },
      { new: true }
    );

    const [updatedOrder, updatedListing] = await Promise.all([
      GeneratedApiRecordModel.findByIdAndUpdate(
        order._id,
        {
          $set: {
            status: "paid",
            "data.paymentStatus": "paid",
            "data.paidAt": new Date().toISOString(),
            "data.fulfillmentStatus": "processing"
          },
          $push: {
            history: {
              action: "orders.payment-confirmed",
              actorId: userId,
              actorType: "customer",
              at: new Date(),
              metadata: { paymentIntentId }
            }
          }
        },
        { new: true }
      ),
      GeneratedApiRecordModel.findByIdAndUpdate(
        listingId,
        {
          $set: {
            status: "sold",
            "data.listingStatus": "sold",
            "data.purchaseStatus": "sold",
            "data.orderId": order._id.toString()
          },
          $push: {
            history: {
              action: "listings.sold",
              actorId: userId,
              actorType: "customer",
              at: new Date(),
              metadata: { orderId, paymentIntentId }
            }
          }
        },
        { new: true }
      )
    ]);

    return {
      order: serializeRecord(updatedOrder ?? order),
      listing: updatedListing ? serializeRecord(updatedListing) : null
    };
  }

  public static async applyStripePaymentIntentEvent(
    object: Record<string, unknown>,
    eventType: string
  ): Promise<void> {
    const paymentIntentId = stringValue(object.id);
    if (!paymentIntentId) {
      return;
    }
    const metadata = typeof object.metadata === "object" && object.metadata !== null && !Array.isArray(object.metadata)
      ? object.metadata as Record<string, unknown>
      : {};
    const purchaseId = stringValue(metadata.purchaseId);
    if (purchaseId) {
      await PurchasesService.applyStripeProductPaymentEvent(object, eventType, purchaseId, metadata);
      return;
    }
    const orderId = stringValue(metadata.orderId);
    const buyerId = stringValue(metadata.buyerId);
    if (!orderId || !buyerId || !Types.ObjectId.isValid(orderId)) {
      return;
    }
    const succeeded = eventType === "payment_intent.succeeded";
    const paymentStatus = succeeded ? "paid" : "payment_failed";
    const intentStatus = stringValue(object.status) ?? (succeeded ? "succeeded" : "failed");

    await GeneratedApiRecordModel.findOneAndUpdate(
      {
        resource: "payment-intent",
        ownerId: buyerId,
        deletedAt: null,
        "scope.paymentIntentId": paymentIntentId
      },
      {
        $set: {
          status: intentStatus,
          "data.status": intentStatus
        },
        $push: {
          history: {
            action: `payment-intent.${eventType}`,
            actorType: "stripe",
            at: new Date(),
            metadata: { orderId, paymentIntentId }
          }
        }
      },
      { new: true }
    );

    const order = await GeneratedApiRecordModel.findOne({
      _id: orderId,
      resource: "orders",
      ownerId: buyerId,
      deletedAt: null
    });
    if (!order) {
      return;
    }

    const paidAt = new Date().toISOString();
    const updatedOrder = await GeneratedApiRecordModel.findByIdAndUpdate(
      order._id,
      {
        $set: succeeded
          ? {
              status: "paid",
              "data.paymentStatus": "paid",
              "data.paidAt": paidAt,
              "data.fulfillmentStatus": "processing"
            }
          : {
              "data.paymentStatus": paymentStatus,
              "data.lastPaymentError": object.last_payment_error ?? null
            },
        $push: {
          history: {
            action: succeeded ? "orders.payment-confirmed" : "orders.payment-failed",
            actorType: "stripe",
            at: new Date(),
            metadata: { paymentIntentId, eventType }
          }
        }
      },
      { new: true }
    );

    if (!succeeded) {
      return;
    }
    const listingId = stringValue(updatedOrder?.data.listingId ?? order.data.listingId);
    if (!listingId) {
      return;
    }
    await GeneratedApiRecordModel.findByIdAndUpdate(
      listingId,
      {
        $set: {
          status: "sold",
          "data.listingStatus": "sold",
          "data.purchaseStatus": "sold",
          "data.orderId": order._id.toString()
        },
        $push: {
          history: {
            action: "listings.sold",
            actorType: "stripe",
            at: new Date(),
            metadata: { orderId, paymentIntentId }
          }
        }
      },
      { new: true }
    );
  }

  private static async applyStripeProductPaymentEvent(
    object: Record<string, unknown>,
    eventType: string,
    purchaseId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const paymentIntentId = stringValue(object.id);
    const buyerId = stringValue(metadata.buyerId);
    if (!paymentIntentId || !buyerId || !Types.ObjectId.isValid(purchaseId)) {
      return;
    }
    const succeeded = eventType === "payment_intent.succeeded";
    const paymentStatus = succeeded ? "paid" : "payment_failed";
    const intentStatus = stringValue(object.status) ?? (succeeded ? "succeeded" : "failed");

    await GeneratedApiRecordModel.findOneAndUpdate(
      {
        resource: "payment-intent",
        ownerId: buyerId,
        deletedAt: null,
        "scope.paymentIntentId": paymentIntentId
      },
      {
        $set: {
          status: intentStatus,
          "data.status": intentStatus
        },
        $push: {
          history: {
            action: `payment-intent.${eventType}`,
            actorType: "stripe",
            at: new Date(),
            metadata: { purchaseId, paymentIntentId }
          }
        }
      },
      { new: true }
    );

    const productPayment = await GeneratedApiRecordModel.findOne({
      _id: purchaseId,
      resource: "product-payments",
      ownerId: buyerId,
      deletedAt: null
    });
    if (!productPayment) {
      return;
    }

    const paidAt = new Date().toISOString();
    const updatedProductPayment = await GeneratedApiRecordModel.findByIdAndUpdate(
      productPayment._id,
      {
        $set: succeeded
          ? {
              status: "paid",
              "data.paymentStatus": "paid",
              "data.paidAt": paidAt,
              "data.fulfillmentStatus": "processing"
            }
          : {
              status: "payment_failed",
              "data.paymentStatus": paymentStatus,
              "data.lastPaymentError": object.last_payment_error ?? null
            },
        $push: {
          history: {
            action: succeeded ? "product-payments.payment-confirmed" : "product-payments.payment-failed",
            actorType: "stripe",
            at: new Date(),
            metadata: { paymentIntentId, eventType }
          }
        }
      },
      { new: true }
    );

    if (!succeeded) {
      return;
    }
    const listingId = stringValue(updatedProductPayment?.data.listingId ?? productPayment.data.listingId);
    if (!listingId) {
      return;
    }
    await GeneratedApiRecordModel.findByIdAndUpdate(
      listingId,
      {
        $set: {
          status: "sold",
          "data.listingStatus": "sold",
          "data.purchaseStatus": "sold",
          "data.purchaseId": productPayment._id.toString()
        },
        $push: {
          history: {
            action: "listings.sold",
            actorType: "stripe",
            at: new Date(),
            metadata: { purchaseId, paymentIntentId }
          }
        }
      },
      { new: true }
    );
  }

  private async requirePurchasableListing(
    listingId: string,
    buyerId: string
  ): Promise<GeneratedApiRecordDocument> {
    const listing = await this.requireListing(listingId);
    if (listing.ownerId === buyerId) {
      throw new ConflictError("You cannot purchase your own listing.");
    }
    const listingStatus = stringValue(listing.data.listingStatus) ?? stringValue(listing.data.purchaseStatus);
    if (unavailableListingStatuses.has(listing.status) || (listingStatus && unavailableListingStatuses.has(listingStatus))) {
      throw new ConflictError("Listing is not available for purchase.");
    }
    return listing;
  }

  private async requireListing(listingId: string): Promise<GeneratedApiRecordDocument> {
    if (!Types.ObjectId.isValid(listingId)) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    const listing = await GeneratedApiRecordModel.findOne({
      _id: listingId,
      resource: "listings",
      deletedAt: null
    });
    if (!listing) {
      throw new ResourceNotFoundError("Listing not found.");
    }
    return listing;
  }

  private async requireOwnedOrder(userId: string, orderId: string): Promise<GeneratedApiRecordDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new ResourceNotFoundError("Order not found.");
    }
    const order = await GeneratedApiRecordModel.findOne({
      _id: orderId,
      resource: "orders",
      deletedAt: null
    });
    if (!order) {
      throw new ResourceNotFoundError("Order not found.");
    }
    if (order.ownerId !== userId) {
      throw new AuthorizationError("You can only access your own orders.");
    }
    return order;
  }

  private async requireCustomer(userId: string) {
    const account = await CustomerAccountModel.findOne({ _id: userId, deletedAt: null });
    if (!account) {
      throw new ResourceNotFoundError("Customer not found.");
    }
    return account;
  }

  private async findOrCreateProductPayment(input: ProductPaymentCreateInput): Promise<SerializedPurchaseRecord> {
    const existing = await GeneratedApiRecordModel.findOne({
      resource: "product-payments",
      ownerId: input.userId,
      deletedAt: null,
      "scope.idempotencyKey": input.idempotencyKey
    });
    if (existing) {
      if (!reusableProductPaymentStatuses.has(existing.status)) {
        throw new ConflictError("This product payment is not reusable.");
      }
      return serializeRecord(existing);
    }

    try {
      const productPayment = await GeneratedApiRecordModel.create({
        resource: "product-payments",
        ownerId: input.userId,
        scope: {
          listingId: input.listingId,
          idempotencyKey: input.idempotencyKey
        },
        data: {
          listingId: input.listingId,
          buyerId: input.userId,
          sellerId: input.sellerId,
          buyer: {
            id: input.userId,
            displayName: input.buyer.displayName,
            email: input.buyer.email
          },
          seller: {
            id: input.sellerId,
            displayName: input.seller.displayName
          },
          product: input.snapshot,
          title: stringValue(input.snapshot.title) ?? "Internal product",
          quantity: input.quantity,
          subtotal: input.total,
          total: input.total,
          currency: input.currency,
          paymentStatus: "requires_payment",
          fulfillmentStatus: "pending"
        },
        status: "pending_payment",
        history: [
          {
            action: "product-payments.created",
            actorId: input.userId,
            actorType: "customer",
            at: new Date(),
            metadata: {
              listingId: input.listingId,
              total: input.total,
              currency: input.currency,
              idempotencyKey: input.idempotencyKey
            }
          }
        ]
      });
      return serializeRecord(productPayment);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const productPayment = await GeneratedApiRecordModel.findOne({
        resource: "product-payments",
        ownerId: input.userId,
        deletedAt: null,
        "scope.idempotencyKey": input.idempotencyKey
      });
      if (!productPayment) {
        throw error;
      }
      return serializeRecord(productPayment);
    }
  }

  private publicPaymentIntent(paymentIntent: PaymentIntent, amount: number) {
    return {
      id: paymentIntent.id,
      clientSecret: paymentIntent.clientSecret,
      status: paymentIntent.status,
      amount,
      amountMinor: paymentIntent.amount,
      currency: paymentIntent.currency.toUpperCase(),
      provider: paymentIntent.id.startsWith("local_") ? "local" : "stripe"
    };
  }

  private async reusablePaymentIntentRecord(
    userId: string,
    orderId: string,
    paymentIdempotencyKey: string
  ): Promise<GeneratedApiRecordDocument | null> {
    const records = await GeneratedApiRecordModel.find({
      resource: "payment-intent",
      ownerId: userId,
      deletedAt: null,
      "scope.orderId": orderId,
      "scope.idempotencyKey": paymentIdempotencyKey
    }).sort({ createdAt: -1 });
    return records.find((record) => reusablePaymentIntentStatuses.has(record.status)) ?? null;
  }

  private async reusableProductPaymentIntentRecord(
    userId: string,
    purchaseId: string,
    paymentIdempotencyKey: string
  ): Promise<GeneratedApiRecordDocument | null> {
    const records = await GeneratedApiRecordModel.find({
      resource: "payment-intent",
      ownerId: userId,
      deletedAt: null,
      "scope.purchaseId": purchaseId,
      "scope.idempotencyKey": paymentIdempotencyKey
    }).sort({ createdAt: -1 });
    return records.find((record) => reusablePaymentIntentStatuses.has(record.status)) ?? null;
  }

  private publicPaymentIntentFromRecord(record: GeneratedApiRecordDocument) {
    return {
      id: stringValue(record.data.paymentIntentId) ?? record._id.toString(),
      clientSecret: stringValue(record.data.clientSecret) ?? null,
      status: stringValue(record.data.status) ?? record.status,
      amount: numberValue(record.data.amount) ?? 0,
      amountMinor: numberValue(record.data.amountMinor) ?? 0,
      currency: stringValue(record.data.currency)?.toUpperCase() ?? "USD",
      provider: stringValue(record.data.provider) ?? "stripe"
    };
  }
}
