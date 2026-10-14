import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { authenticateAccessToken } from "../common/auth/authenticate.js";
import type { AuthenticatedActor } from "../common/auth/auth.types.js";
import type { WatchboxLogger } from "../common/utils/logger.js";

export type RealtimeEventName =
  | "notification:new"
  | "notification:read"
  | "notification:deleted"
  | "notifications:read-all"
  | "notifications:cleared"
  | "unread-count:updated"
  | "support-ticket:created"
  | "support-ticket:closed"
  | "support-message:new"
  | "seller-contact:created";

export type RealtimeEventPayload = {
  action: string;
  aggregateId: string;
  params: Record<string, string>;
  data: Record<string, unknown>;
  occurredAt: string;
};

export interface RealtimePublisher {
  emitToCustomer(customerId: string, event: RealtimeEventName, payload: RealtimeEventPayload): void;
  emitToAdmins(event: RealtimeEventName, payload: RealtimeEventPayload): void;
}

type ClientToServerEvents = Record<string, never>;
type ServerToClientEvents = Record<string, (payload: RealtimeEventPayload) => void>;
type InterServerEvents = Record<string, never>;
type SocketData = {
  auth?: AuthenticatedActor;
};
type SocketAuthenticator = (
  token: string,
  audience: "customer" | "admin"
) => Promise<AuthenticatedActor>;
type CustomerSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const customerRoom = (customerId: string): string => `customer:${customerId}`;
const adminSupportRoom = "admin:support";

const handshakeToken = (socket: CustomerSocket): string | undefined => {
  const handshakeAuth: unknown = socket.handshake.auth;
  const authToken =
    typeof handshakeAuth === "object" &&
    handshakeAuth !== null &&
    "token" in handshakeAuth &&
    typeof handshakeAuth.token === "string"
      ? handshakeAuth.token
      : undefined;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.startsWith("Bearer ") ? authToken.slice(7) : authToken;
  }

  const authorization = socket.handshake.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
};

const handshakeAudience = (socket: CustomerSocket): "customer" | "admin" => {
  const handshakeAuth: unknown = socket.handshake.auth;
  return typeof handshakeAuth === "object" &&
    handshakeAuth !== null &&
    "audience" in handshakeAuth &&
    handshakeAuth.audience === "admin"
    ? "admin"
    : "customer";
};

export class SocketRealtimeService implements RealtimePublisher {
  private readonly io: SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >;

  public constructor(
    private readonly logger: WatchboxLogger,
    private readonly authenticateSocket: SocketAuthenticator = (token, audience) =>
      authenticateAccessToken(token, audience)
  ) {
    this.io = new SocketServer({
      cors: {
        origin: true,
        credentials: true
      }
    });

    this.io.use((socket, next) => {
      void (async () => {
        const token = handshakeToken(socket);
        if (!token) {
          throw new Error("An access token is required.");
        }
        const auth = await this.authenticateSocket(token, handshakeAudience(socket));
        if (auth.audience === "admin" && !auth.permissions.includes("reports.read")) {
          throw new Error("Support message permission is required.");
        }
        socket.data.auth = auth;
        next();
      })().catch((error: unknown) => {
        this.logger.warn({ error }, "Socket authentication failed");
        next(new Error("Authentication failed."));
      });
    });

    this.io.on("connection", (socket) => {
      const auth = socket.data.auth;
      if (!auth) {
        socket.disconnect(true);
        return;
      }

      void socket.join(auth.audience === "admin" ? adminSupportRoom : customerRoom(auth.id));
      this.logger.info(
        { socketId: socket.id, actorId: auth.id, audience: auth.audience, sessionId: auth.sessionId },
        "Authenticated socket connected"
      );

      socket.on("disconnect", (reason) => {
        this.logger.info(
          { socketId: socket.id, actorId: auth.id, audience: auth.audience, reason },
          "Authenticated socket disconnected"
        );
      });
    });
  }

  public attach(server: HttpServer): void {
    this.io.attach(server);
  }

  public emitToCustomer(
    customerId: string,
    event: RealtimeEventName,
    payload: RealtimeEventPayload
  ): void {
    this.io.to(customerRoom(customerId)).emit(event, payload);
  }

  public emitToAdmins(event: RealtimeEventName, payload: RealtimeEventPayload): void {
    this.io.to(adminSupportRoom).emit(event, payload);
  }

  public disconnectAll(): void {
    this.io.disconnectSockets(true);
  }
}
