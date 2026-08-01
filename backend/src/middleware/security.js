import { createError } from "../utils/errors.js";

const buckets = new Map();
const MAX_BUCKETS = 10000;

function pruneBuckets(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size >= MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, keyPrefix = "rate" } = {}) {
  return (req, _res, next) => {
    const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 254);
    const key = `${keyPrefix}:${req.ip}:${email}`;
    const now = Date.now();
    if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) pruneBuckets(now);
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return next(createError("Too many attempts. Please try again later.", 429));
    }

    return next();
  };
}
