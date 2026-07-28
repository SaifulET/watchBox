import type { RedisClient } from "../../infrastructure/redis/client.js";
import { RateLimitError } from "../errors/app-error.js";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
};

export class RateLimiterService {
  public constructor(private readonly redis?: RedisClient) {}

  public async consume(options: RateLimitOptions): Promise<void> {
    if (!this.redis) {
      return;
    }

    const key = `rate-limit:${options.key}`;
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, options.windowSeconds);
    }

    if (attempts > options.limit) {
      throw new RateLimitError(options.message);
    }
  }
}
