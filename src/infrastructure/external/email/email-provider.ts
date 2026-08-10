import nodemailer, { type Transporter } from "nodemailer";
import { randomUUID } from "node:crypto";
import { getEmailConfig } from "../../../config/email.config.js";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
  }>;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}

export class NodemailerEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  public constructor() {
    const config = getEmailConfig();
    this.from = config.from;

    if (config.provider === "smtp" && config.smtp.host) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth:
          config.smtp.user && config.smtp.password
            ? {
                user: config.smtp.user,
                pass: config.smtp.password
              }
            : undefined
      });
      return;
    }

    this.transporter = nodemailer.createTransport({
      jsonTransport: true
    });
  }

  public async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    const rawResult = (await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments
    })) as unknown;
    const result = rawResult as { messageId?: string };

    return {
      providerMessageId: result.messageId || `local-email:${message.to}:${randomUUID()}`
    };
  }
}

export class LocalEmailProvider extends NodemailerEmailProvider {
  public override async send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    await super.send(message);
    return { providerMessageId: `local-email:${message.to}:${randomUUID()}` };
  }
}
