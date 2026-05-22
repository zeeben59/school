import crypto from 'node:crypto'

const REGISTRATION_OTP_MINUTES = parseInt(process.env.REGISTRATION_OTP_MINUTES || '10', 10)

export function createNumericOtp(length = 6) {
  const max = 10 ** length
  const value = crypto.randomInt(0, max)
  return value.toString().padStart(length, '0')
}

export function hashOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

export function getRegistrationOtpExpiry() {
  return new Date(Date.now() + REGISTRATION_OTP_MINUTES * 60 * 1000)
}

export function getRegistrationOtpMinutes() {
  return REGISTRATION_OTP_MINUTES
}
