import { createServer, type Server } from "node:http";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "../../src/common/utils/logger.js";
import {
  SocketRealtimeService,
  type RealtimeEventPayload
} from "../../src/realtime/socket-realtime.service.js";

describe("SocketRealtimeService", () => {
  let server: Server | undefined;
  let client: Socket | undefined;
  let realtime: SocketRealtimeService | undefined;

  afterEach(async () => {
    client?.disconnect();
    realtime?.disconnectAll();
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("authenticates a customer and emits events to that customer's room", async () => {
    realtime = new SocketRealtimeService(createLogger({ service: "socket-test" }), (token) => {
      expect(token).toBe("valid-access-token");
      return Promise.resolve({
        id: "customer-1",
        audience: "customer",
        sessionId: "session-1",
        permissions: []
      });
    });
    server = createServer();
    realtime.attach(server);
    await listen(server);

    client = io(serverUrl(server), {
      auth: { token: "valid-access-token" },
      transports: ["websocket"],
      reconnection: false
    });
    await once(client, "connect");

    const payload: RealtimeEventPayload = {
      action: "support.created",
      aggregateId: "message-1",
      params: { ticketId: "ticket-1" },
      data: { message: "Hello" },
      occurredAt: new Date().toISOString()
    };
    const received = once<RealtimeEventPayload>(client, "support-message:new");
    realtime.emitToCustomer("customer-1", "support-message:new", payload);

    await expect(received).resolves.toEqual(payload);
  });

  it("rejects a connection without an access token", async () => {
    realtime = new SocketRealtimeService(createLogger({ service: "socket-test" }));
    server = createServer();
    realtime.attach(server);
    await listen(server);

    client = io(serverUrl(server), {
      transports: ["websocket"],
      reconnection: false
    });

    const error = await once<Error>(client, "connect_error");
    expect(error.message).toBe("Authentication failed.");
  });

  it("authenticates admins and emits support events to the admin room", async () => {
    realtime = new SocketRealtimeService(
      createLogger({ service: "socket-test" }),
      (token, audience) => {
        expect(token).toBe("admin-access-token");
        expect(audience).toBe("admin");
        return Promise.resolve({
          id: "admin-1",
          audience: "admin",
          sessionId: "admin-session-1",
          permissions: ["reports.read"]
        });
      }
    );
    server = createServer();
    realtime.attach(server);
    await listen(server);

    client = io(serverUrl(server), {
      auth: { token: "admin-access-token", audience: "admin" },
      transports: ["websocket"],
      reconnection: false
    });
    await once(client, "connect");

    const payload: RealtimeEventPayload = {
      action: "support.created",
      aggregateId: "ticket-1",
      params: { ticketId: "ticket-1" },
      data: {},
      occurredAt: new Date().toISOString()
    };
    const received = once<RealtimeEventPayload>(client, "support-ticket:created");
    realtime.emitToAdmins("support-ticket:created", payload);

    await expect(received).resolves.toEqual(payload);
  });

  it("rejects admin support sockets without reports.read permission", async () => {
    realtime = new SocketRealtimeService(createLogger({ service: "socket-test" }), () =>
      Promise.resolve({
        id: "admin-1",
        audience: "admin",
        sessionId: "admin-session-1",
        permissions: []
      })
    );
    server = createServer();
    realtime.attach(server);
    await listen(server);

    client = io(serverUrl(server), {
      auth: { token: "admin-access-token", audience: "admin" },
      transports: ["websocket"],
      reconnection: false
    });

    const error = await once<Error>(client, "connect_error");
    expect(error.message).toBe("Authentication failed.");
  });
});

const listen = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
};

const serverUrl = (server: Server): string => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }
  return `http://127.0.0.1:${address.port}`;
};

const once = async <T = void>(socket: Socket, event: string): Promise<T> =>
  new Promise<T>((resolve) => {
    socket.once(event, (value: T) => resolve(value));
  });
