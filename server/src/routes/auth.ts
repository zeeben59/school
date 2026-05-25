import { FastifyInstance } from 'fastify'
import { register, login, getMe } from '../controllers/auth-supabase.js'
import { createRateLimiter } from '../utils/rate-limit.js'

export default async function authRoutes(fastify: FastifyInstance) {
  const registrationLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyPrefix: 'register',
    keyGenerator: request => {
      const body = (request.body || {}) as { email?: string }
      return `${request.ip}:${body.email || 'anonymous'}`
    }
  })

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'login',
    keyGenerator: request => {
      const body = (request.body || {}) as { email?: string }
      return `${request.ip}:${body.email || 'anonymous'}`
    }
  })

  fastify.post('/register', { preHandler: registrationLimiter }, register)
  fastify.post('/login', { preHandler: loginLimiter }, login)
  fastify.get('/me', getMe)
}
