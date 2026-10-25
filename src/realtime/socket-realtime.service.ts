import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { authenticateAccessToken } from "../common/auth/authenticate.js";
import type { AuthenticatedActor } from "../common/auth/auth.types.js";
import type { WatchboxLogger } from "../common/utils/logger.js";
import { ChatService, type SendChatMessageInput } from "../modules/customer/chats/chat.service.js";

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
  | "receive_message"
  | "typing"
  | "stop_typing"
  | "message_seen"
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

type SocketAck = (response: { success: boolean; data?: unknown; error?: string }) => void;
type ClientToServerEvents = {
  join_chat: (chatId: string, ack?: SocketAck) => void;
  send_message: (input: SendChatMessageInput & { chatId: string }, ack?: SocketAck) => void;
  typing: (input: { chatId: string }) => void;
  stop_typing: (input: { chatId: string }) => void;
  mark_seen: (input: { chatId: string; messageId: string }, ack?: SocketAck) => void;
};
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
      authenticateAccessToken(token, audience),
    private readonly chats = new ChatService()
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
      if (auth.audience === "customer") this.registerChatHandlers(socket, auth.id);
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

  private registerChatHandlers(socket: CustomerSocket, userId: string): void {
    const join = async (chatId: string): Promise<string> => {
      await this.chats.participants(userId, chatId);
      const room = `chat:${chatId}`;
      await socket.join(room);
      return room;
    };
    socket.on("join_chat", (chatId, ack) => {
      void join(chatId).then(() => ack?.({ success: true })).catch((error: unknown) => {
        this.logger.warn({ error, userId, chatId }, "Chat room join rejected");
        ack?.({ success: false, error: "Unable to join conversation." });
      });
    });
    socket.on("send_message", (input, ack) => {
      void (async () => {
        await join(input.chatId);
        const result = await this.chats.send(userId, input.chatId, input);
        this.io.to(`chat:${input.chatId}`).emit("receive_message", result.message as RealtimeEventPayload);
        for (const participantId of result.participantIds) {
          this.io.to(customerRoom(participantId)).emit("receive_message", result.message as RealtimeEventPayload);
        }
        ack?.({ success: true, data: result.message });
      })().catch((error: unknown) => {
        this.logger.warn({ error, userId, chatId: input.chatId }, "Socket message rejected");
        ack?.({ success: false, error: "Unable to send message." });
      });
    });
    for (const event of ["typing", "stop_typing"] as const) {
      socket.on(event, (input) => {
        void join(input.chatId).then((room) => socket.to(room).emit(event, { chatId: input.chatId } as RealtimeEventPayload)).catch(() => undefined);
      });
    }
    socket.on("mark_seen", (input, ack) => {
      void this.chats.markSeen(userId, input.chatId, input.messageId).then((result) => {
        this.io.to(`chat:${input.chatId}`).emit("message_seen", { chatId: input.chatId, messageId: input.messageId } as unknown as RealtimeEventPayload);
        ack?.({ success: true, data: result.message });
      }).catch(() => ack?.({ success: false, error: "Unable to mark message as seen." }));
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
