import { FastifyReply, FastifyRequest } from 'fastify'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getBucket(key: string, windowMs: number) {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    // Clean up a small sample of expired buckets to prevent unbounded growth
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k)
      }
    }
    const fresh = { count: 0, resetAt: now + windowMs }
    buckets.set(key, fresh)
    return fresh
  }

  return existing
}

export function createRateLimiter(options: {
  windowMs: number
  max: number
  keyPrefix: string
  keyGenerator?: (request: FastifyRequest) => string
}) {
  return async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
    const suffix = options.keyGenerator ? options.keyGenerator(request) : request.ip
    const bucket = getBucket(`${options.keyPrefix}:${suffix}`, options.windowMs)
    bucket.count += 1

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000))
      return reply
        .header('Retry-After', retryAfterSeconds)
        .status(429)
        .send({ error: 'Too many requests. Please try again later.' })
    }
  }
}
