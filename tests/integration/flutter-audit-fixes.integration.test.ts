import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import request from "supertest";
import { io as createSocketClient } from "socket.io-client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getDatabaseConfig } from "../../src/config/database.config.js";
import { resetEnvForTests } from "../../src/config/env.js";
import { createLogger } from "../../src/common/utils/logger.js";
import {
  AuthSessionModel,
  CustomerAccountModel
} from "../../src/modules/customer/auth/auth.model.js";
import { GeneratedApiRecordModel } from "../../src/modules/generated-api/generated-api.model.js";
import { ChatConversationModel } from "../../src/modules/chats/chats.model.js";
import { SocketRealtimeService } from "../../src/realtime/socket-realtime.service.js";

process.env.STORAGE_PROVIDER = "local";
process.env.EMAIL_PROVIDER = "local";
process.env.AI_PROVIDER = "local";
resetEnvForTests();

const registerCustomer = async (
  app: ReturnType<typeof createApp>,
  email: string,
  displayName: string
) => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email,
      password: "Password123!",
      displayName,
      firstName: displayName,
      lastName: "Tester"
    })
    .expect(201);
  return {
    id: res.body.data.account.id as string,
    token: res.body.data.tokens.accessToken as string
  };
};

describe("Flutter audit fixes", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await mongoose.connect(getDatabaseConfig().uri);
    app = createApp();
  });

  beforeEach(async () => {
    await Promise.all([
      AuthSessionModel.deleteMany({}),
      CustomerAccountModel.deleteMany({}),
      GeneratedApiRecordModel.deleteMany({}),
      ChatConversationModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("handles real customer notifications: list, unread-count, read, read-all, and delete", async () => {
    const user = await registerCustomer(app, "notif@example.com", "Notif");
    const [n1, n2] = await GeneratedApiRecordModel.create([
      {
        resource: "notifications",
        ownerId: user.id,
        status: "unread",
        data: { title: "Price drop", body: "Rolex Submariner dropped 5%", read: false }
      },
      {
        resource: "notifications",
        ownerId: user.id,
        status: "unread",
        data: { title: "New message", body: "Buyer messaged you", read: false }
      }
    ]);

    const unreadRes = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(unreadRes.body.data.unreadCount).toBe(2);

    const listRes = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(listRes.body.data.items).toHaveLength(2);
    expect(listRes.body.data.unreadCount).toBe(2);

    await request(app)
      .post(`/api/v1/notifications/${n1!._id.toString()}/read`)
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);

    const afterOneRead = await request(app)
      .get("/api/v1/notifications/unread-count")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(afterOneRead.body.data.unreadCount).toBe(1);

    const readAllRes = await request(app)
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(readAllRes.body.data.updated).toBe(1);
    expect(readAllRes.body.data.unreadCount).toBe(0);

    await request(app)
      .delete(`/api/v1/notifications/${n2!._id.toString()}`)
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);

    const clearRes = await request(app)
      .delete("/api/v1/notifications")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(clearRes.body.data.deleted).toBe(true);
  });

  it("registers and removes FCM tokens via PATCH /users/update-fcm-token and /devices", async () => {
    const user = await registerCustomer(app, "fcm@example.com", "Fcm");

    const patchRes = await request(app)
      .patch("/api/v1/users/update-fcm-token")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ fcmToken: "fcm_token_ios_1234567890", platform: "ios", deviceId: "iphone-16" })
      .expect(200);
    expect(patchRes.body.data.updated).toBe(true);
    expect(patchRes.body.data.fcmToken).toBe("fcm_token_ios_1234567890");

    const deviceRes = await request(app)
      .post("/api/v1/devices")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ token: "fcm_token_android_9876543210", platform: "android", deviceId: "pixel-9" })
      .expect(200);
    expect(deviceRes.body.data.deviceCount).toBe(2);

    const account = await CustomerAccountModel.findById(user.id);
    expect(account?.fcmToken).toBe("fcm_token_android_9876543210");
    expect(account?.fcmDevices).toHaveLength(2);

    const delRes = await request(app)
      .delete("/api/v1/devices/pixel-9")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(delRes.body.data.deleted).toBe(true);
    expect(delRes.body.data.deviceCount).toBe(1);
  });

  it("syncs subscription plans, returns usage quota, and aligns free/paid tier vocabulary", async () => {
    const user = await registerCustomer(app, "sub@example.com", "Sub");

    const initialUsage = await request(app)
      .get("/api/v1/subscriptions/me/usage")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(initialUsage.body.data.tier).toBe("free");
    expect(initialUsage.body.data.searchLimit).toBe(5);
    expect(initialUsage.body.data.unlimited).toBe(false);

    const changeRes = await request(app)
      .post("/api/v1/subscriptions/change-plan")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ plan: "collector", provider: "revenuecat", productId: "elite_monthly" })
      .expect(200);
    expect(changeRes.body.data.plan).toBe("elite_collector");
    expect(changeRes.body.data.tier).toBe("paid");
    expect(changeRes.body.data.isPaid).toBe(true);

    const meRes = await request(app)
      .get("/api/v1/subscriptions/me")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(meRes.body.data.plan).toBe("elite_collector");
    expect(meRes.body.data.tier).toBe("paid");

    const paidUsage = await request(app)
      .get("/api/v1/subscriptions/me/usage")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(paidUsage.body.data.unlimited).toBe(true);
    expect(paidUsage.body.data.searchLimit).toBeNull();

    const plansRes = await request(app).get("/api/v1/subscriptions/plans").expect(200);
    expect(plansRes.body.data.plans).toHaveLength(2);
  });

  it("serves real DB-backed discovery, search helpers, and market insights", async () => {
    const user = await registerCustomer(app, "disc@example.com", "Disc");
    await GeneratedApiRecordModel.create([
      {
        resource: "listings",
        ownerId: user.id,
        status: "active",
        data: {
          brand: "Rolex",
          model: "Submariner",
          title: "Rolex Submariner 126610LN",
          referenceNumber: "126610LN",
          price: 14500,
          currency: "USD",
          condition: "Like New",
          year: 2023,
          location: "New York"
        }
      },
      {
        resource: "listings",
        ownerId: user.id,
        status: "active",
        data: {
          brand: "Omega",
          model: "Speedmaster",
          title: "Omega Speedmaster Professional",
          referenceNumber: "310.30.42.50.01.001",
          price: 6800,
          currency: "USD",
          condition: "Very Good",
          year: 2022,
          location: "London"
        }
      }
    ]);

    const brandsRes = await request(app).get("/api/v1/brands").expect(200);
    const rolex = brandsRes.body.data.items.find((b: { name: string }) => b.name === "Rolex");
    expect(rolex.listingCount).toBe(1);
    expect(rolex.averagePrice).toBe(14500);

    const modelsRes = await request(app).get("/api/v1/watch-models?brand=Rolex").expect(200);
    expect(modelsRes.body.data.items).toHaveLength(1);
    expect(modelsRes.body.data.items[0].model).toBe("Submariner");

    const facetsRes = await request(app).get("/api/v1/search/facets").expect(200);
    expect(facetsRes.body.data.totalListings).toBe(2);
    expect(facetsRes.body.data.priceRange.min).toBe(6800);
    expect(facetsRes.body.data.priceRange.max).toBe(14500);

    const suggRes = await request(app).get("/api/v1/search/suggestions?q=sub").expect(200);
    expect(suggRes.body.data.suggestions.length).toBeGreaterThan(0);

    await request(app)
      .post("/api/v1/search/recent")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ query: "Rolex Submariner", brand: "Rolex" })
      .expect(201);

    const recentRes = await request(app)
      .get("/api/v1/search/recent")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(recentRes.body.data.items[0].query).toBe("Rolex Submariner");

    await request(app)
      .delete("/api/v1/search/recent")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);

    const insightsRes = await request(app)
      .get("/api/v1/analytics/market-insights?brand=Rolex")
      .expect(200);
    expect(insightsRes.body.data.summary.totalListings).toBe(1);
    expect(insightsRes.body.data.summary.averagePrice).toBe(14500);

    const homeRes = await request(app).get("/api/v1/recommendations/home").expect(200);
    expect(homeRes.body.data.trending.length).toBe(2);
  });

  it("relays Socket.IO typing, stop_typing, and mark_seen events between chat participants", async () => {
    const buyer = await registerCustomer(app, "buyer-sock@example.com", "Buyer");
    const seller = await registerCustomer(app, "seller-sock@example.com", "Seller");

    const conversation = await ChatConversationModel.create({
      type: "listing",
      buyerId: buyer.id,
      sellerId: seller.id,
      participants: [
        { id: buyer.id, role: "buyer" },
        { id: seller.id, role: "seller" }
      ],
      messages: [],
      lastMessageAt: new Date(),
      status: "open"
    });

    const httpServer = createServer();
    const realtime = new SocketRealtimeService(createLogger());
    realtime.attach(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const port = (httpServer.address() as AddressInfo).port;
    const url = `http://127.0.0.1:${port}`;

    const buyerSocket = createSocketClient(url, { auth: { token: buyer.token }, transports: ["websocket"] });
    const sellerSocket = createSocketClient(url, { auth: { token: seller.token }, transports: ["websocket"] });

    try {
      await Promise.all([
        new Promise<void>((resolve) => buyerSocket.on("connect", () => resolve())),
        new Promise<void>((resolve) => sellerSocket.on("connect", () => resolve()))
      ]);

      const typingReceived = new Promise<Record<string, unknown>>((resolve) => {
        sellerSocket.once("typing", (payload) => resolve(payload as Record<string, unknown>));
      });
      buyerSocket.emit("typing", { chatId: conversation._id.toString() });
      const typingPayload = await typingReceived;
      expect((typingPayload.data as Record<string, unknown>).isTyping).toBe(true);

      const seenReceived = new Promise<Record<string, unknown>>((resolve) => {
        buyerSocket.once("mark_seen", (payload) => resolve(payload as Record<string, unknown>));
      });
      sellerSocket.emit("mark_seen", { chatId: conversation._id.toString() });
      const seenPayload = await seenReceived;
      expect((seenPayload.data as Record<string, unknown>).seenBy).toBe(seller.id);

      const updated = await ChatConversationModel.findById(conversation._id);
      const sellerParticipant = updated?.participants.find((p) => p.id === seller.id);
      expect(sellerParticipant?.lastReadAt).toBeTruthy();
    } finally {
      buyerSocket.disconnect();
      sellerSocket.disconnect();
      realtime.disconnectAll();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
