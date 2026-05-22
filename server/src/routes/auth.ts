import { FastifyInstance } from 'fastify'
import {
  forgotPassword,
  resetPassword,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  verifyEmail,
} from '../controllers/auth-otp.js'
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

  const recoveryLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyPrefix: 'recovery',
    keyGenerator: request => {
      const body = (request.body || {}) as { email?: string }
      return `${request.ip}:${body.email || 'anonymous'}`
    }
  })

  const otpLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 5,
    keyPrefix: 'registration-otp',
    keyGenerator: request => {
      const body = (request.body || {}) as { email?: string }
      return `${request.ip}:${body.email || 'anonymous'}`
    }
  })

  fastify.post('/register', { preHandler: registrationLimiter }, register)
  fastify.post('/verify-registration-otp', { preHandler: otpLimiter }, verifyRegistrationOtp)
  fastify.post('/resend-registration-otp', { preHandler: otpLimiter }, resendRegistrationOtp)
  fastify.post('/login', { preHandler: loginLimiter }, login)
  fastify.post('/forgot-password', { preHandler: recoveryLimiter }, forgotPassword)
  fastify.post('/reset-password', { preHandler: recoveryLimiter }, resetPassword)
  fastify.get('/verify-email', verifyEmail)
  fastify.get('/me', getMe)
}
