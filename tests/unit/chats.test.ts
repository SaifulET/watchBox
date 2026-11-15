import { describe, expect, it } from "vitest";
import {
  customerRoleInChat,
  isCustomerInChat,
  messagePreview,
  unreadCountFor
} from "../../src/modules/chats/chats.helpers.js";
import {
  adminOpenChatBodySchema,
  openChatBodySchema
} from "../../src/modules/chats/chats.validation.js";

const objectId = "64f000000000000000000001";
const buyerId = "64f000000000000000000002";
const sellerId = "64f000000000000000000003";

describe("chat visibility", () => {
  it("lets both buyer and seller see the same thread", () => {
    const chat = { buyerId, sellerId };
    expect(isCustomerInChat(chat, buyerId)).toBe(true);
    expect(isCustomerInChat(chat, sellerId)).toBe(true);
    expect(isCustomerInChat(chat, objectId)).toBe(false);
    expect(customerRoleInChat(chat, buyerId)).toBe("buyer");
    expect(customerRoleInChat(chat, sellerId)).toBe("seller");
  });

  it("counts unread messages after a participant last read", () => {
    const now = new Date("2026-10-27T10:00:00.000Z");
    const later = new Date("2026-10-27T10:05:00.000Z");
    const unread = unreadCountFor(
      {
        participants: [{ id: buyerId, role: "buyer", lastReadAt: now }],
        messages: [
          {
            id: "1",
            senderId: buyerId,
            senderRole: "buyer",
            createdAt: now,
            attachments: []
          },
          {
            id: "2",
            senderId: "admin-1",
            senderRole: "admin",
            message: "Admin joined this chat.",
            createdAt: later,
            attachments: []
          }
        ]
      },
      buyerId
    );
    expect(unread).toBe(1);
  });

  it("builds a preview from text or attachments", () => {
    expect(messagePreview("Is this still available?")).toBe("Is this still available?");
    expect(messagePreview(undefined, 2)).toBe("Sent 2 attachments");
  });
});

describe("chat payloads", () => {
  it("opens a listing chat or an admin chat", () => {
    expect(openChatBodySchema.parse({ listingId: objectId, message: "Hello" }).listingId).toBe(
      objectId
    );
    expect(openChatBodySchema.parse({ withAdmin: true, message: "Need help" }).withAdmin).toBe(true);
    expect(() => openChatBodySchema.parse({ message: "Missing target" })).toThrow();
  });

  it("lets admin contact an existing or listing chat", () => {
    const parsed = adminOpenChatBodySchema.parse({
      listingId: objectId,
      buyerId,
      message: "Admin can see this thread."
    });
    expect(parsed.listingId).toBe(objectId);
    expect(parsed.buyerId).toBe(buyerId);
  });
});
