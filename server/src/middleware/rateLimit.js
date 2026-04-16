import RateLimitBucket from "../models/rateLimitBucket.js";

const memoryBuckets = new Map();

function getBucketKey(prefix, req) {
  const userKey = req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`;
  return `${prefix}:${userKey}`;
}

function getWindowBounds(nowMs, windowMs) {
  const startMs = Math.floor(nowMs / windowMs) * windowMs;
  return {
    windowStart: new Date(startMs),
    windowEnd: new Date(startMs + windowMs),
  };
}

function setRateHeaders(res, { max, remaining, retryAfterSeconds }) {
  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  if (retryAfterSeconds != null) {
    res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
  }
}

export function createInMemoryRateLimiter({
  prefix,
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
}) {
  const safePrefix = String(prefix || "default");
  const safeWindowMs = Math.max(1000, Number(windowMs) || 60_000);
  const safeMax = Math.max(1, Number(max) || 10);

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = getBucketKey(safePrefix, req);
    const current = memoryBuckets.get(key);

    if (!current || now >= current.resetAt) {
      memoryBuckets.set(key, {
        count: 1,
        resetAt: now + safeWindowMs,
      });
      setRateHeaders(res, { max: safeMax, remaining: safeMax - 1 });
      return next();
    }

    if (current.count >= safeMax) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      setRateHeaders(res, {
        max: safeMax,
        remaining: 0,
        retryAfterSeconds,
      });
      return res.status(429).json({ error: message });
    }

    current.count += 1;
    memoryBuckets.set(key, current);
    setRateHeaders(res, { max: safeMax, remaining: safeMax - current.count });
    return next();
  };
}

export function createMongoRateLimiter({
  prefix,
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
  failOpen = false,
}) {
  const safePrefix = String(prefix || "default");
  const safeWindowMs = Math.max(1000, Number(windowMs) || 60_000);
  const safeMax = Math.max(1, Number(max) || 10);

  return async function mongoRateLimiter(req, res, next) {
    const nowMs = Date.now();
    const key = getBucketKey(safePrefix, req);
    const { windowStart, windowEnd } = getWindowBounds(nowMs, safeWindowMs);

    try {
      let bucket = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          bucket = await RateLimitBucket.findOneAndUpdate(
            { key, windowStart },
            {
              $setOnInsert: {
                key,
                windowStart,
                expiresAt: windowEnd,
              },
              $inc: { count: 1 },
            },
            {
              upsert: true,
              returnDocument: "after",
            },
          )
            .select("count expiresAt")
            .lean();

          break;
        } catch (error) {
          if (error?.code === 11000 && attempt === 0) {
            continue;
          }
          throw error;
        }
      }

      if (!bucket) {
        throw new Error("Rate limit bucket was not created.");
      }

      if (bucket.count > safeMax) {
        const retryAfterSeconds = Math.ceil(
          (new Date(bucket.expiresAt).getTime() - nowMs) / 1000,
        );
        setRateHeaders(res, {
          max: safeMax,
          remaining: 0,
          retryAfterSeconds,
        });
        return res.status(429).json({ error: message });
      }

      setRateHeaders(res, {
        max: safeMax,
        remaining: safeMax - bucket.count,
      });
      return next();
    } catch (error) {
      if (!failOpen) {
        return next(error);
      }

      setRateHeaders(res, { max: safeMax, remaining: safeMax });
      return next();
    }
  };
}
