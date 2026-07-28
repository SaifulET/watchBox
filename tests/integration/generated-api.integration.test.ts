import { createHmac } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { getDatabaseConfig } from "../../src/config/database.config.js";
import { getEnv } from "../../src/config/env.js";
import { AdminAccountModel, CustomerAccountModel } from "../../src/modules/customer/auth/auth.model.js";
import { PasswordService } from "../../src/modules/customer/auth/password.service.js";
import { GeneratedApiRecordModel } from "../../src/modules/generated-api/generated-api.model.js";

const app = createApp();

type DataResponse<TData> = {
  success: true;
  data: TData;
};

type AuthResponse = DataResponse<{
  account: {
    id: string;
  };
  tokens: {
    accessToken: string;
  };
}>;

type RecordResponse = DataResponse<{
  id: string;
  data: Record<string, unknown>;
  status: string;
}>;

const connectForTests = async (): Promise<void> => {
  mongoose.set("strictQuery", true);
  mongoose.set("sanitizeFilter", true);
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: `${config.databaseName}-test`,
    autoIndex: true
  });
};

const registerCustomer = async (): Promise<string> => {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      email: "generated-customer@example.com",
      password: "generated-password",
      displayName: "Generated Customer"
    })
    .expect(201);
  const body = response.body as AuthResponse;
  return body.data.tokens.accessToken;
};

const loginAdmin = async (): Promise<string> => {
  const passwords = new PasswordService();
  await AdminAccountModel.create({
    email: "generated-admin@example.com",
    displayName: "Generated Admin",
    passwordHash: await passwords.hash("admin-password"),
    permissions: ["admin:dashboard"],
    roles: ["dashboard-admin"]
  });

  const response = await request(app)
    .post("/api/v1/admin/auth/login")
    .send({ email: "generated-admin@example.com", password: "admin-password" })
    .expect(200);
  const body = response.body as AuthResponse;
  return body.data.tokens.accessToken;
};

describe("generated API routes", () => {
  beforeAll(async () => {
    await connectForTests();
  });

  beforeEach(async () => {
    await Promise.all([
      CustomerAccountModel.deleteMany({}),
      AdminAccountModel.deleteMany({}),
      GeneratedApiRecordModel.deleteMany({})
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("serves public catalogue reads from the generated API layer", async () => {
    const response = await request(app).get("/api/v1/brands").expect(200);
    const body = response.body as DataResponse<unknown[]> & { meta: { total: number } };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("persists and updates a customer-owned listing record", async () => {
    const accessToken = await registerCustomer();
    const authorization = `Bearer ${accessToken}`;

    const createdResponse = await request(app)
      .post("/api/v1/listings")
      .set("Authorization", authorization)
      .send({ title: "Rolex Submariner", price: 12500, currency: "USD" })
      .expect(201);
    const created = createdResponse.body as RecordResponse;
    expect(created.data.data.title).toBe("Rolex Submariner");

    const updatedResponse = await request(app)
      .patch(`/api/v1/listings/${created.data.id}`)
      .set("Authorization", authorization)
      .send({ price: 11900 })
      .expect(200);
    const updated = updatedResponse.body as RecordResponse;
    expect(updated.data.data.price).toBe(11900);

    const publishedResponse = await request(app)
      .post(`/api/v1/listings/${created.data.id}/publish`)
      .set("Authorization", authorization)
      .send({})
      .expect(200);
    const published = publishedResponse.body as DataResponse<{ record: { status: string } }>;
    expect(published.data.record.status).toBe("active");
  });

  it("enforces admin auth and permissions on generated admin APIs", async () => {
    await request(app).get("/api/v1/admin/dashboard/summary").expect(401);

    const accessToken = await loginAdmin();
    const response = await request(app)
      .get("/api/v1/admin/dashboard/summary")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const body = response.body as DataResponse<unknown[]>;
    expect(body.data).toEqual([]);
  });

  it("accepts signed webhook events and stores them", async () => {
    const payload = { id: "evt_test", type: "email.delivered" };
    const signature = createHmac("sha256", getEnv().ENCRYPTION_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    const response = await request(app)
      .post("/api/v1/webhooks/email")
      .set("x-watchbox-signature", signature)
      .send(payload)
      .expect(201);
    const body = response.body as RecordResponse;
    expect(body.data.data.id).toBe("evt_test");
  });
});
