export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ providerMessageId: string }>;
}

export class LocalEmailProvider implements EmailProvider {
  public send(message: EmailMessage): Promise<{ providerMessageId: string }> {
    return Promise.resolve({ providerMessageId: `local-email:${message.to}:${Date.now()}` });
  }
}
