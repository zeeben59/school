import crypto from 'node:crypto'

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173'
const EMAIL_VERIFICATION_HOURS = parseInt(process.env.EMAIL_VERIFICATION_TOKEN_HOURS || '24', 10)
const PASSWORD_RESET_MINUTES = parseInt(process.env.PASSWORD_RESET_TOKEN_MINUTES || '30', 10)

export function createRawToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function getEmailVerificationExpiry() {
  return new Date(Date.now() + EMAIL_VERIFICATION_HOURS * 60 * 60 * 1000)
}

export function getPasswordResetExpiry() {
  return new Date(Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000)
}

export function getPasswordResetTokenMinutes() {
  return PASSWORD_RESET_MINUTES
}

export function buildEmailVerificationUrl(token: string) {
  return `${APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`
}

export function buildPasswordResetUrl(token: string) {
  return `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`
}

export function shouldExposeDebugLinks() {
  return process.env.EMAIL_DEBUG_LINKS === 'true'
}
