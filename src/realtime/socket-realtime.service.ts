import type { Server as HttpServer } from "node:http";
import mongoose from "mongoose";
import { Server as SocketServer, type Socket } from "socket.io";
import { authenticateAccessToken } from "../common/auth/authenticate.js";
import type { AuthenticatedActor } from "../common/auth/auth.types.js";
import type { WatchboxLogger } from "../common/utils/logger.js";
import { ChatConversationModel } from "../modules/chats/chats.model.js";

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
  | "seller-contact:created"
  | "chat:created"
  | "chat-message:new"
  | "typing"
  | "stop_typing"
  | "mark_seen"
  | "report:created"
  | "report:updated"
  | "report:deleted";

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

type ChatPresenceInput = {
  chatId?: unknown;
  conversationId?: unknown;
  roomId?: unknown;
};

type ClientToServerEvents = {
  typing: (payload: ChatPresenceInput) => void;
  stop_typing: (payload: ChatPresenceInput) => void;
  mark_seen: (payload: ChatPresenceInput) => void;
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

      socket.on("typing", (payload) => {
        void this.handleTypingEvent(auth, payload, "typing").catch((error: unknown) => {
          this.logger.warn({ error, actorId: auth.id }, "Failed to relay typing event");
        });
      });

      socket.on("stop_typing", (payload) => {
        void this.handleTypingEvent(auth, payload, "stop_typing").catch((error: unknown) => {
          this.logger.warn({ error, actorId: auth.id }, "Failed to relay stop_typing event");
        });
      });

      socket.on("mark_seen", (payload) => {
        void this.handleMarkSeenEvent(auth, payload).catch((error: unknown) => {
          this.logger.warn({ error, actorId: auth.id }, "Failed to process mark_seen event");
        });
      });

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

  private extractChatId(payload: ChatPresenceInput | undefined): string | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }
    const candidate = payload.chatId ?? payload.conversationId ?? payload.roomId;
    return typeof candidate === "string" && mongoose.isValidObjectId(candidate.trim())
      ? candidate.trim()
      : undefined;
  }

  private async handleTypingEvent(
    auth: AuthenticatedActor,
    payload: ChatPresenceInput | undefined,
    event: "typing" | "stop_typing"
  ): Promise<void> {
    const chatId = this.extractChatId(payload);
    if (!chatId) {
      return;
    }
    const conversation = await ChatConversationModel.findOne({ _id: chatId, deletedAt: null });
    if (!conversation) {
      return;
    }
    const isParticipant = conversation.participants.some((p) => p.id === auth.id);
    if (!isParticipant && !(auth.audience === "admin" && conversation.type === "support")) {
      return;
    }
    const eventPayload: RealtimeEventPayload = {
      action: `chat.${event}`,
      aggregateId: chatId,
      params: { chatId },
      data: {
        chatId,
        userId: auth.id,
        audience: auth.audience,
        isTyping: event === "typing"
      },
      occurredAt: new Date().toISOString()
    };
    for (const participant of conversation.participants) {
      if (participant.role !== "admin" && participant.id !== auth.id) {
        this.emitToCustomer(participant.id, event, eventPayload);
      }
    }
    if (conversation.type === "support" && auth.audience === "customer") {
      this.emitToAdmins(event, eventPayload);
    }
  }

  private async handleMarkSeenEvent(
    auth: AuthenticatedActor,
    payload: ChatPresenceInput | undefined
  ): Promise<void> {
    const chatId = this.extractChatId(payload);
    if (!chatId) {
      return;
    }
    const conversation = await ChatConversationModel.findOne({ _id: chatId, deletedAt: null });
    if (!conversation) {
      return;
    }
    const existingParticipant = conversation.participants.find((p) => p.id === auth.id);
    if (!existingParticipant && !(auth.audience === "admin" && conversation.type === "support")) {
      return;
    }
    const seenAt = new Date();
    if (existingParticipant) {
      existingParticipant.lastReadAt = seenAt;
    } else if (auth.audience === "admin") {
      conversation.participants.push({
        id: auth.id,
        role: "admin",
        lastReadAt: seenAt
      });
    }
    await conversation.save();

    const eventPayload: RealtimeEventPayload = {
      action: "chat.mark_seen",
      aggregateId: chatId,
      params: { chatId },
      data: {
        chatId,
        seenBy: auth.id,
        audience: auth.audience,
        seenAt: seenAt.toISOString()
      },
      occurredAt: seenAt.toISOString()
    };
    for (const participant of conversation.participants) {
      if (participant.role !== "admin" && participant.id !== auth.id) {
        this.emitToCustomer(participant.id, "mark_seen", eventPayload);
      }
    }
    if (conversation.type === "support" && auth.audience === "customer") {
      this.emitToAdmins("mark_seen", eventPayload);
    }
  }
}
