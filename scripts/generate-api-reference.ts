import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { requiredApiEndpoints } from "./api-inventory.js";

type Endpoint = (typeof requiredApiEndpoints)[number];

type PostmanItem = {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string }>;
    auth?: {
      type: "bearer";
      bearer: Array<{ key: "token"; value: string; type: "string" }>;
    };
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string }>;
    };
    body?: {
      mode: "raw";
      raw: string;
      options: {
        raw: {
          language: "json";
        };
      };
    };
  };
  response: Array<{
    name: string;
    originalRequest: PostmanItem["request"];
    status: string;
    code: number;
    body: string;
  }>;
};

const docsPath = join(process.cwd(), "docs", "API_REQUEST_RESPONSE.md");
const postmanPath = join(process.cwd(), "docs", "postman", "watchbox-api.postman_collection.json");
const baseUrl = "{{baseUrl}}";

const pathToPostman = (path: string): string => path.replace(/:([A-Za-z0-9_]+)/g, "{{$1}}");

const isPublic = (endpoint: Endpoint): boolean =>
  endpoint.auth === "Public" ||
  endpoint.path.includes("/auth/login") ||
  endpoint.path.includes("/auth/register") ||
  endpoint.path.includes("/auth/refresh") ||
  endpoint.path.includes("forgot-password") ||
  endpoint.path.includes("reset-password") ||
  endpoint.path.includes("verify-email") ||
  endpoint.path.includes("verify-reset-code") ||
  endpoint.path.includes("mfa/challenge") ||
  endpoint.path.includes("/oauth/callback") ||
  endpoint.path.includes("/oauth/declined") ||
  endpoint.path.startsWith("/api/v1/webhooks") ||
  endpoint.path.startsWith("/health") ||
  endpoint.path.startsWith("/internal") ||
  endpoint.path === "/api/v1" ||
  endpoint.path === "/api/v1/admin" ||
  endpoint.path === "/api/v1/payments/config" ||
  endpoint.path.startsWith("/api/v1/content/") ||
  endpoint.path.startsWith("/api/v1/public/");

const exampleBody = (endpoint: Endpoint): Record<string, unknown> | undefined => {
  if (!["POST", "PATCH", "PUT"].includes(endpoint.method)) {
    return undefined;
  }

  if (endpoint.path.endsWith("/auth/register")) {
    return {
      email: "customer@example.com",
      password: "customer-password",
      displayName: "Customer One"
    };
  }
  if (endpoint.path.endsWith("/auth/login")) {
    return {
      email: endpoint.path.includes("/admin/") ? "admin@example.com" : "customer@example.com",
      password: endpoint.path.includes("/admin/") ? "admin-password" : "customer-password"
    };
  }
  if (endpoint.path.endsWith("/auth/refresh")) {
    return { refreshToken: "{{refreshToken}}" };
  }
  if (
    endpoint.path.includes("verify-email/request") ||
    (endpoint.path.includes("forgot-password") && !endpoint.path.includes("/verify"))
  ) {
    return { email: "customer@example.com" };
  }
  if (endpoint.path.includes("mfa/challenge")) {
    return { email: "admin@example.com" };
  }
  if (endpoint.path.includes("verify-email/confirm") || endpoint.path.includes("forgot-password/verify")) {
    return { email: "customer@example.com", otp: "123456" };
  }
  if (endpoint.path.includes("verify-reset-code")) {
    return { token: "{{token}}" };
  }
  if (endpoint.path.includes("/auth/reset-password") && !endpoint.path.includes("/admin/")) {
    return {
      email: "customer@example.com",
      newPassword: "new-password",
      confirmPassword: "new-password"
    };
  }
  if (endpoint.path.includes("reset-password")) {
    return {
      token: "{{token}}",
      newPassword: "new-password",
      confirmPassword: "new-password"
    };
  }
  if (endpoint.path.includes("change-password")) {
    return { currentPassword: "current-password", newPassword: "new-password" };
  }
  if (endpoint.path === "/api/v1/public/contact") {
    return {
      name: "Alex Collector",
      email: "customer@example.com",
      subject: "Question about my listing",
      message: "I need help updating my watch listing photos."
    };
  }
  if (endpoint.path === "/api/v1/public/account-deletion") {
    return {
      email: "customer@example.com",
      password: "customer-password",
      confirmation: "DELETE"
    };
  }
  if (endpoint.path.includes("mfa/verify")) {
    return { code: "{{mfaCode}}" };
  }
  if (endpoint.path === "/api/v1/notification-preferences" && endpoint.method === "PATCH") {
    return { emailAlerts: true };
  }
  if (endpoint.path === "/api/v1/users/me" && endpoint.method === "PATCH") {
    return { displayName: "Updated Name", phone: "+15551234567", country: "United States" };
  }
  if (endpoint.path.includes("/dark-mode")) {
    return { darkMode: true };
  }
  if (endpoint.path.includes("/preferences")) {
    return { currency: "USD" };
  }
  if (endpoint.path.includes("/avatar/confirm")) {
    return { avatarKey: "{{avatarKey}}" };
  }
  if (endpoint.path.startsWith("/api/v1/webhooks")) {
    return { id: "evt_123", type: "event.received", data: { example: true } };
  }
  if (endpoint.path.includes("/listings") && endpoint.method === "POST") {
    return {
      title: "Rolex Submariner Date",
      brand: "Rolex",
      model: "Submariner",
      price: 12500,
      currency: "USD",
      condition: "excellent"
    };
  }
  if (endpoint.path.includes("/subscriptions/change-plan")) {
    return { planId: "{{planId}}" };
  }
  if (endpoint.path.includes("/orders") && endpoint.method === "POST") {
    return { listingId: "{{listingId}}", offerAmount: 12000, currency: "USD" };
  }
  if (endpoint.path.includes("/support/tickets") && endpoint.method === "POST") {
    return { subject: "Need help", message: "Please help with my order." };
  }
  if (endpoint.path.includes("/reports")) {
    return { reason: "suspicious", message: "Please review this item." };
  }
  if (endpoint.path.includes("/ebay/disconnect") || endpoint.path.includes("/publish-to-ebay")) {
    return {};
  }
  if (endpoint.path.includes("/ebay/search-by-location") || endpoint.path.includes("/chrono24/search-by-location")) {
    return { keyword: "Rolex Submariner", latitude: 40.7128, longitude: -74.006, radiusMiles: 50 };
  }
  if (endpoint.path.includes("/saved-products") && endpoint.method === "POST") {
    return { title: "Rolex Submariner Date", price: 12500, currency: "USD", source: "ebay", externalId: "v1|123456789|0" };
  }
  if (endpoint.path.includes("/watch-alerts") && endpoint.method === "POST") {
    return { title: "Rolex Submariner Alert", brand: "Rolex", model: "Submariner", maxPrice: 13000, currency: "USD" };
  }
  if (endpoint.path.includes("/subscription/checkout")) {
    return { planId: "pro_monthly", successUrl: "https://mywatchbox.net/success", cancelUrl: "https://mywatchbox.net/cancel" };
  }
  if (endpoint.path.includes("/subscription/portal")) {
    return { returnUrl: "https://mywatchbox.net/profile" };
  }
  if (endpoint.path.includes("/payments/products/") && endpoint.path.includes("/payment-intent")) {
    return { amount: 12500, currency: "USD" };
  }
  if (endpoint.path.includes("/orders/") && endpoint.path.includes("/confirm-payment")) {
    return { paymentIntentId: "pi_123456789" };
  }
  if (endpoint.path.includes("/ai/analyze-image") || endpoint.path.includes("/ai/search") || endpoint.path.includes("/image-search/")) {
    return { source: "upload", platform: "all" };
  }
  if (endpoint.path.includes("/admin/administrators") && endpoint.method === "POST") {
    return { email: "admin2@example.com", name: "Admin Two", role: "moderator" };
  }
  if (endpoint.method === "PATCH") {
    return { name: "Updated value", status: "active" };
  }
  return { name: "Example", description: "Example request body" };
};

const successResponse = (endpoint: Endpoint): Record<string, unknown> => {
  if (endpoint.path === "/api/v1/notification-preferences") {
    return {
      success: true,
      data: {
        emailAlerts: endpoint.method === "PATCH"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("/dark-mode")) {
    return {
      success: true,
      data: {
        darkMode: endpoint.method === "PATCH"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path === "/api/v1/users/me/preferences") {
    return {
      success: true,
      data: {
        currency: "USD"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.method === "GET" && !endpoint.path.match(/:\w+/)) {
    return {
      success: true,
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        requestId: "request-id"
      }
    };
  }

  if (endpoint.path.includes("/auth/register") || endpoint.path.includes("/auth/login")) {
    return {
      success: true,
      data: {
        account: {
          id: "64f000000000000000000001",
          email: endpoint.path.includes("/admin/") ? "admin@example.com" : "customer@example.com",
          displayName: endpoint.path.includes("/admin/") ? "Admin One" : "Customer One",
          ...(endpoint.path.includes("/admin/")
            ? {}
            : {
                darkMode: false,
                notificationPreferences: {
                  emailAlerts: true
                },
                preferences: {
                  currency: "USD"
                }
              })
        },
        sessionId: "64f000000000000000000002",
        tokens: {
          accessToken: "jwt-access-token",
          refreshToken: "jwt-refresh-token",
          tokenType: "Bearer",
          expiresIn: 900
        }
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("/refresh")) {
    return {
      success: true,
      data: {
        sessionId: "64f000000000000000000002",
        tokens: {
          accessToken: "new-jwt-access-token",
          refreshToken: "new-jwt-refresh-token",
          tokenType: "Bearer",
          expiresIn: 900
        }
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("verify-email/confirm")) {
    return {
      success: true,
      data: {
        verified: true
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("verify-email/request")) {
    return {
      success: true,
      data: {
        delivery: "email",
        expiresInMinutes: 10,
        developmentOtp: "123456"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("forgot-password/verify")) {
    return {
      success: true,
      data: {
        verified: true
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("forgot-password")) {
    return {
      success: true,
      data: {
        delivery: "email",
        expiresInMinutes: 15,
        developmentOtp: "123456"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("/ebay/connect")) {
    return {
      success: true,
      data: {
        authorizationUrl: "https://auth.ebay.com/oauth2/authorize?client_id=example&response_type=code&redirect_uri=https://api.mywatchbox.net/api/v1/ebay/oauth/callback&scope=https://api.ebay.com/oauth/api_scope"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("/ebay/status")) {
    return {
      success: true,
      data: {
        connected: true,
        ebayUsername: "watch_dealer_nyc",
        expiresAt: "2026-12-31T23:59:59.000Z"
      },
      meta: { requestId: "request-id" }
    };
  }

  if (endpoint.path.includes("/payments/config")) {
    return {
      success: true,
      data: {
        publishableKey: "pk_test_sample_key",
        currency: "usd"
      },
      meta: { requestId: "request-id" }
    };
  }

  return {
    success: true,
    data: {
      id: "64f000000000000000000001",
      resource: endpoint.path.split("/").filter(Boolean).at(-1)?.replace(/^:/, "") ?? "resource",
      status: "active",
      data: exampleBody(endpoint) ?? {}
    },
    meta: { requestId: "request-id" }
  };
};

const errorResponse = {
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed.",
    details: [{ path: "field", message: "Required" }]
  },
  meta: { requestId: "request-id" }
};

const authHeader = (endpoint: Endpoint): Array<{ key: string; value: string }> => {
  const headers = [{ key: "Content-Type", value: "application/json" }];
  if (endpoint.path.startsWith("/api/v1/webhooks")) {
    headers.push({ key: "x-watchbox-signature", value: "{{webhookSignature}}" });
  }
  return headers;
};

const markdownForEndpoint = (endpoint: Endpoint): string => {
  const url = `${baseUrl}${pathToPostman(endpoint.path)}`;
  const body = exampleBody(endpoint);
  const auth = isPublic(endpoint) ? "No auth" : `Bearer token required (${endpoint.auth})`;
  return [
    `### ${endpoint.method} ${endpoint.path}`,
    "",
    `Auth: ${auth}`,
    "",
    "Request:",
    "",
    "```http",
    `${endpoint.method} ${url}`,
    isPublic(endpoint) ? "" : "Authorization: Bearer {{accessToken}}",
    endpoint.path.startsWith("/api/v1/webhooks") ? "x-watchbox-signature: {{webhookSignature}}" : "",
    "Content-Type: application/json",
    "```",
    "",
    "Request body:",
    "",
    "```json",
    body ? JSON.stringify(body, null, 2) : "null",
    "```",
    "",
    "Success response:",
    "",
    "```json",
    JSON.stringify(successResponse(endpoint), null, 2),
    "```",
    "",
    "Error response:",
    "",
    "```json",
    JSON.stringify(errorResponse, null, 2),
    "```",
    ""
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const postmanItem = (endpoint: Endpoint): PostmanItem => {
  const path = pathToPostman(endpoint.path);
  const body = exampleBody(endpoint);
  const request: PostmanItem["request"] = {
    method: endpoint.method,
    header: authHeader(endpoint),
    url: {
      raw: `${baseUrl}${path}`,
      host: ["{{baseUrl}}"],
      path: path.replace(/^\//, "").split("/")
    }
  };
  if (!isPublic(endpoint)) {
    request.auth = {
      type: "bearer",
      bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }]
    };
  }
  if (body) {
    request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: "json" } }
    };
  }
  return {
    name: `${endpoint.method} ${endpoint.path}`,
    request,
    response: [
      {
        name: "Success",
        originalRequest: request,
        status: "OK",
        code: endpoint.method === "POST" && !endpoint.path.match(/:\w+/) ? 201 : 200,
        body: JSON.stringify(successResponse(endpoint), null, 2)
      }
    ]
  };
};

mkdirSync(dirname(docsPath), { recursive: true });
mkdirSync(dirname(postmanPath), { recursive: true });

writeFileSync(
  docsPath,
  [
    "# WatchBox API Request And Response Reference",
    "",
    "Base URL: `http://localhost:4000`",
    "",
    "Use `{{accessToken}}` from login/register responses for protected routes.",
    "Use `{{refreshToken}}` from login/register responses for refresh routes.",
    "",
    ...requiredApiEndpoints.map(markdownForEndpoint)
  ].join("\n"),
  "utf8"
);

writeFileSync(
  postmanPath,
  JSON.stringify(
    {
      info: {
        name: "WatchBox API",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      variable: [
        { key: "baseUrl", value: "http://localhost:4000" },
        { key: "accessToken", value: "" },
        { key: "refreshToken", value: "" },
        { key: "token", value: "" },
        { key: "webhookSignature", value: "" }
      ],
      item: requiredApiEndpoints.map(postmanItem)
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Wrote ${requiredApiEndpoints.length} endpoint docs to ${docsPath}`);
console.log(`Wrote Postman collection to ${postmanPath}`);
