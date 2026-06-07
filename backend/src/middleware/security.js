import { createError } from "../utils/errors.js";

const buckets = new Map();

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, keyPrefix = "rate" } = {}) {
  return (req, _res, next) => {
    const key = `${keyPrefix}:${req.ip}:${String(req.body?.email || "").toLowerCase()}`;
    const now = Date.now();
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
