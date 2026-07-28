export type AuthAudience = "customer" | "admin";

export type AuthenticatedActor = {
  id: string;
  audience: AuthAudience;
  sessionId: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedActor;
    }
  }
}

export {};
