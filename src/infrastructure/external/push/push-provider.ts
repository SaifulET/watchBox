export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export interface PushProvider {
  send(message: PushMessage): Promise<{ providerMessageId: string }>;
}

export class LocalPushProvider implements PushProvider {
  public send(message: PushMessage): Promise<{ providerMessageId: string }> {
    return Promise.resolve({ providerMessageId: `local-push:${message.token}:${Date.now()}` });
  }
}
