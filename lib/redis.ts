import { Redis } from "@upstash/redis";

// Lazy initialization to avoid build-time errors
let _redis: Redis | null = null;
let _redisAvailable: boolean | null = null;

function isRedisConfigured(): boolean {
  if (_redisAvailable !== null) return _redisAvailable;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redisAvailable = !!(url && token);
  return _redisAvailable;
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_, prop) {
    const client = getRedis();
    if (!client) {
      // Return no-op functions when Redis isn't configured
      return () => Promise.resolve(null);
    }
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

// Visit counter keys
export const visitCountKey = (spaceId: string) => `visits:${spaceId}:total`;
export const dailyVisitKey = (spaceId: string, date: string) => `visits:${spaceId}:daily:${date}`;

// Helper functions for visit tracking
export async function incrementVisitCount(spaceId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  // Increment both total and daily counts
  const [total] = await Promise.all([
    redis.incr(visitCountKey(spaceId)),
    redis.incr(dailyVisitKey(spaceId, today)),
  ]);

  return total;
}

export async function getVisitCount(spaceId: string): Promise<number> {
  const count = await redis.get<number>(visitCountKey(spaceId));
  return count ?? 0;
}

// Rate limiting helpers
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
