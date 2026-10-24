import { getEnv } from "../../config/env.js";
import { AuthenticationError } from "../../common/errors/app-error.js";
import { RateLimiterService } from "../../common/services/rate-limiter.service.js";
import { DomainEventPublisher } from "../../common/services/domain-event-publisher.js";
import type { EmailProvider } from "../../infrastructure/external/email/email-provider.js";
import type { RedisClient } from "../../infrastructure/redis/client.js";
import { CustomerAccountRepository } from "../customer/auth/auth.repository.js";
import { PasswordService } from "../customer/auth/password.service.js";
import { GeneratedApiRecordModel } from "../generated-api/generated-api.model.js";
import { UserService } from "../customer/users/users.service.js";
import type { PublicAccountDeletionInput, PublicContactInput } from "./public-pages.validation.js";

type PublicPagesDependencies = {
  events: DomainEventPublisher;
  email: EmailProvider;
  redis?: RedisClient;
  customers?: CustomerAccountRepository;
  users?: UserService;
};

type RequestFingerprint = {
  ipAddress?: string;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export class PublicPagesService {
  private readonly customers: CustomerAccountRepository;
  private readonly users: UserService;
  private readonly passwords = new PasswordService();
  private readonly rateLimiter: RateLimiterService;

  public constructor(private readonly dependencies: PublicPagesDependencies) {
    this.customers = dependencies.customers ?? new CustomerAccountRepository();
    this.users =
      dependencies.users ??
      new UserService({
        events: dependencies.events,
        ...(dependencies.redis ? { redis: dependencies.redis } : {})
      });
    this.rateLimiter = new RateLimiterService(dependencies.redis);
  }

  public async submitContact(
    input: PublicContactInput,
    fingerprint: RequestFingerprint
  ): Promise<{ submitted: true; ticketId: string }> {
    await this.rateLimiter.consume({
      key: `public-contact:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 5,
      windowSeconds: 15 * 60,
      message: "Too many contact requests. Please try again later."
    });

    const account = await this.customers.findByEmail(input.email);
    const ticket = await GeneratedApiRecordModel.create({
      resource: "support",
      ...(account ? { ownerId: account._id.toString() } : {}),
      scope: { source: "public-contact" },
      data: {
        subject: input.subject,
        message: input.message,
        name: input.name,
        email: input.email,
        source: "public-contact"
      },
      status: "open",
      history: [
        {
          action: "support.public-contact",
          actorType: "public",
          at: new Date(),
          metadata: { email: input.email }
        }
      ]
    });

    try {
      await this.sendContactEmails(input, ticket._id.toString());
    } catch {
      // The support ticket is stored even if email delivery fails.
    }

    return {
      submitted: true,
      ticketId: ticket._id.toString()
    };
  }

  public async deleteAccount(
    input: PublicAccountDeletionInput,
    fingerprint: RequestFingerprint
  ): Promise<{ deleted: true }> {
    await this.rateLimiter.consume({
      key: `public-account-deletion:${fingerprint.ipAddress ?? "unknown"}:${input.email}`,
      limit: 5,
      windowSeconds: 15 * 60,
      message: "Too many deletion attempts. Please try again later."
    });

    const account = await this.customers.findByEmail(input.email);
    if (!account || !(await this.passwords.verify(account.passwordHash, input.password))) {
      throw new AuthenticationError("Invalid email or password.");
    }

    const email = account.email;
    await this.users.deleteMe(account._id.toString());
    await this.sendDeletionEmail(email).catch(() => undefined);

    return { deleted: true };
  }

  private async sendContactEmails(input: PublicContactInput, ticketId: string): Promise<void> {
    const supportInbox = getEnv().EMAIL_FROM;
    const safeName = escapeHtml(input.name);
    const safeEmail = escapeHtml(input.email);
    const safeSubject = escapeHtml(input.subject);
    const safeMessage = escapeHtml(input.message).replaceAll("\n", "<br />");

    await Promise.all([
      this.dependencies.email.send({
        to: supportInbox,
        subject: `WatchBox contact: ${input.subject}`,
        html: `<p><strong>From:</strong> ${safeName} (${safeEmail})</p><p><strong>Ticket:</strong> ${ticketId}</p><p><strong>Subject:</strong> ${safeSubject}</p><p>${safeMessage}</p>`
      }),
      this.dependencies.email.send({
        to: input.email,
        subject: "We received your WatchBox message",
        html: `<p>Hi ${safeName},</p><p>We received your message and created support ticket <strong>${ticketId}</strong>.</p><p><strong>Subject:</strong> ${safeSubject}</p><p>Our team will reply to this email address.</p>`
      })
    ]);
  }

  private async sendDeletionEmail(email: string): Promise<void> {
    await this.dependencies.email.send({
      to: email,
      subject: "Your WatchBox account has been deleted",
      html: "<p>Your WatchBox account and sign-in access have been deleted. If you did not request this, contact support immediately.</p>"
    });
  }
}
