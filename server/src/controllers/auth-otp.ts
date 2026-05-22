import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import { initializePaystackPayment } from './payment.js'
import { emitAdminSchoolsUpdated, emitAdminUsersUpdated } from './admin.js'
import {
  buildPasswordResetUrl,
  createRawToken,
  getPasswordResetExpiry,
  getPasswordResetTokenMinutes,
  hashToken,
} from '../utils/auth-tokens.js'
import {
  createNumericOtp,
  getRegistrationOtpExpiry,
  getRegistrationOtpMinutes,
  hashOtp,
} from '../utils/otp.js'
import { sendPasswordResetEmail, sendRegistrationOtpEmail } from '../utils/mail.js'
import {
  deriveSchoolAccessState,
  getRegistrationFeeKobo,
  REGISTRATION_FEE_NAIRA,
  ensureSchoolSubscriptionState,
} from '../utils/subscription.js'

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const normalizedEmailSchema = z.string().trim().toLowerCase().email()

const registerSchema = z.object({
  schoolName: z.string().min(3),
  email: normalizedEmailSchema,
  password: z.string().min(8),
  directorFullName: z.string().min(3),
  phone: z.string().min(10),
  address: z.string().min(5)
})

const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1)
})

const emailSchema = z.object({
  email: normalizedEmailSchema
})

const sixDigitOtpSchema = z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits')
const verifyRegistrationOtpSchema = z.object({
  email: normalizedEmailSchema,
  otpCode: sixDigitOtpSchema.optional(),
  code: sixDigitOtpSchema.optional()
}).refine(data => Boolean(data.otpCode || data.code), {
  message: 'OTP must be 6 digits',
  path: ['otpCode']
})

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

function splitFullName(fullName: string) {
  const nameParts = fullName.trim().split(' ').filter(Boolean)
  return {
    firstName: nameParts[0] || 'Director',
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeOtpCode(otpCode: string) {
  return otpCode.trim()
}

function isSqliteDiskIoError(error: unknown) {
  const message = String((error as any)?.message || '').toLowerCase()
  return message.includes('sqliteerror') && message.includes('disk i/o error')
}

function getDatabaseErrorMessage(error: unknown): string | null {
  const message = String((error as any)?.message || '').toLowerCase()
  const code = String((error as any)?.code || '').toLowerCase()
  const name = String((error as any)?.name || '').toLowerCase()

  if (
    message.includes("can't reach database server") ||
    message.includes('database connection failed') ||
    message.includes('connect') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    code.includes('p1001') ||
    code.includes('p1002') ||
    name.includes('prismaclientinitializationerror')
  ) {
    return 'Database connection failed. Check DATABASE_URL and database availability.'
  }

  if (isSqliteDiskIoError(error)) {
    return 'Database storage is temporarily unavailable (disk I/O issue).'
  }

  return null
}

async function resolveUsersByEmail(email: string, schoolId?: string) {
  const users = await prisma.user.findMany({
    where: {
      email,
      ...(schoolId ? { schoolId } : {}),
      deletedAt: null
    },
    include: { school: true }
  })

  return users
}

function signAuthToken(reply: FastifyReply, payload: { id: string; email: string; role: string; schoolId: string }) {
  return reply.server.jwt.sign(payload, { expiresIn: JWT_EXPIRES_IN })
}

function mapUserForAuth(
  user: any,
  options?: { accessState?: string; hasActiveSubscription?: boolean; hasActiveTrial?: boolean }
) {
  const hasActiveSubscription = options?.hasActiveSubscription ?? false
  const hasActiveTrial = options?.hasActiveTrial ?? false
  const accessState = options?.accessState ?? deriveSchoolAccessState({
    schoolStatus: user.school?.status,
    hasActiveSubscription,
    hasActiveTrial,
  })

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    school: user.school.name,
    schoolId: user.schoolId,
    status: user.school.status,
    logoUrl: user.school.logoUrl,
    phone: user.school.phone,
    address: user.school.address,
    emailVerifiedAt: user.emailVerifiedAt || null,
    mustChangePassword: Boolean(user.mustChangePassword),
    hasActiveSubscription,
    hasActiveTrial,
    accessState,
  }
}

async function createPasswordResetToken(userId: string) {
  const rawToken = createRawToken()
  const tokenHash = hashToken(rawToken)

  await (prisma as any).passwordResetToken.deleteMany({ where: { userId } })
  await (prisma as any).passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: getPasswordResetExpiry()
    }
  })

  return {
    rawToken,
    resetUrl: buildPasswordResetUrl(rawToken)
  }
}

async function upsertPendingRegistration(input: {
  email: string
  schoolName: string
  firstName: string
  lastName: string
  passwordHash: string
  phone: string
  address: string
  otpHash: string
  otpExpiresAt: Date
}) {
  const existingPending = await (prisma as any).pendingRegistration.findUnique({
    where: { email: input.email }
  })

  if (existingPending) {
    return (prisma as any).pendingRegistration.update({
      where: { email: input.email },
      data: {
        schoolName: input.schoolName,
        directorFirstName: input.firstName,
        directorLastName: input.lastName,
        passwordHash: input.passwordHash,
        phone: input.phone,
        address: input.address,
        otpHash: input.otpHash,
        otpExpiresAt: input.otpExpiresAt,
        otpSentAt: new Date(),
        otpVerifiedAt: null,
        consumedAt: null,
        resendCount: 0,
        status: 'PENDING_OTP'
      }
    })
  }

  return (prisma as any).pendingRegistration.create({
    data: {
      email: input.email,
      schoolName: input.schoolName,
      directorFirstName: input.firstName,
      directorLastName: input.lastName,
      passwordHash: input.passwordHash,
      phone: input.phone,
      address: input.address,
      otpHash: input.otpHash,
      otpExpiresAt: input.otpExpiresAt,
      status: 'PENDING_OTP'
    }
  })
}

async function initializeVerifiedRegistration(pendingRegistration: any) {
  const paymentReference = `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const created = await prisma.$transaction(async (tx) => {
    const existingSchool = await tx.school.findFirst({
      where: { email: pendingRegistration.email, deletedAt: null }
    })

    const school = existingSchool || await tx.school.create({
      data: {
        name: pendingRegistration.schoolName,
        email: pendingRegistration.email,
        phone: pendingRegistration.phone,
        address: pendingRegistration.address,
        status: 'PENDING_PAYMENT'
      }
    })

    const existingDirector = await tx.user.findFirst({
      where: {
        email: pendingRegistration.email,
        schoolId: school.id,
        role: 'DIRECTOR',
        deletedAt: null
      }
    })

    const user = existingDirector || await tx.user.create({
      data: {
        email: pendingRegistration.email,
        password: pendingRegistration.passwordHash,
        firstName: pendingRegistration.directorFirstName,
        lastName: pendingRegistration.directorLastName,
        role: 'DIRECTOR',
        schoolId: school.id,
        emailVerifiedAt: new Date()
      } as any
    })

    const existingPayment = await tx.payment.findFirst({
      where: { schoolId: school.id, type: 'REGISTRATION' },
      orderBy: { createdAt: 'desc' }
    })

    const payment = existingPayment || await tx.payment.create({
      data: {
        amount: REGISTRATION_FEE_NAIRA,
        status: 'PENDING',
        reference: paymentReference,
        schoolId: school.id,
        type: 'REGISTRATION'
      }
    })

    await tx.school.update({
      where: { id: school.id },
      data: {
        name: pendingRegistration.schoolName,
        phone: pendingRegistration.phone,
        address: pendingRegistration.address,
        status: school.status === 'SUSPENDED' ? 'SUSPENDED' : (school.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_PAYMENT')
      }
    })

    await (tx as any).pendingRegistration.update({
      where: { id: pendingRegistration.id },
      data: {
        otpVerifiedAt: new Date(),
        consumedAt: new Date(),
        status: 'CONSUMED'
      }
    })

    return { school, user, payment }
  })

  let authorizationUrl: string | null = null
  try {
    const paystackData = await initializePaystackPayment(
      created.school.id,
      created.user.id,
      pendingRegistration.email,
      getRegistrationFeeKobo(),
      created.payment.reference || paymentReference,
      {
        termName: undefined,
        paymentFor: 'REGISTRATION',
      }
    )
    authorizationUrl = paystackData.authorization_url
  } catch {
    authorizationUrl = null
  }

  return {
    school: created.school,
    user: created.user,
    payment: created.payment,
    authorization_url: authorizationUrl,
    reference: created.payment.reference || paymentReference
  }
}

export const registerSchool = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = registerSchema.parse(request.body)
    const email = normalizeEmail(body.email)
    const { schoolName, password, directorFullName, phone, address } = body
    const { firstName, lastName } = splitFullName(directorFullName)

    const existingUser = await prisma.user.findFirst({ where: { email, deletedAt: null } })
    if (existingUser) {
      return reply.status(400).send({ error: 'Email already registered' })
    }
    const existingSchoolByEmail = await prisma.school.findFirst({ where: { email, deletedAt: null } })
    if (existingSchoolByEmail) {
      return reply.status(409).send({
        error: 'A school profile already exists for this email. Please continue from login or payment recovery.'
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const otpCode = createNumericOtp(6)
    const otpHash = hashOtp(otpCode)
    const otpExpiresAt = getRegistrationOtpExpiry()

    await upsertPendingRegistration({
      email,
      schoolName,
      firstName,
      lastName,
      passwordHash,
      phone,
      address,
      otpHash,
      otpExpiresAt
    })

    try {
      const info = await sendRegistrationOtpEmail({
        email,
        otpCode,
        firstName,
        schoolName,
        expiresInMinutes: getRegistrationOtpMinutes()
      })

      request.log.info({
        email,
        messageId: info?.messageId || null
      }, 'Registration OTP email sent successfully')
    } catch (mailError: any) {
      request.log.error({
        email,
        error: mailError?.message || String(mailError)
      }, 'Failed to send registration OTP email')

      return reply.status(502).send({
        error: 'Failed to send OTP email. Please confirm the email address and try again shortly.'
      })
    }

    request.log.info({
      email,
      otpExpiresAt,
      otpHashPreview: otpHash.slice(0, 12)
    }, 'Registration OTP generated and stored')

    return reply.status(201).send({
      message: 'OTP sent successfully. Verify your email to continue to payment.',
      email,
      expiresAt: otpExpiresAt,
      verificationRequired: true
    })
  } catch (error: any) {
    request.log.error({
      err: error,
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    }, 'Registration failed')

    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Validation failed' })
    }
    return reply.status(500).send({ error: 'Internal server error' })
  }
}

export const resendRegistrationOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parsed = emailSchema.parse(request.body)
    const email = normalizeEmail(parsed.email)

    const pendingRegistration = await (prisma as any).pendingRegistration.findUnique({
      where: { email }
    })

    if (!pendingRegistration) {
      request.log.warn({ email }, 'Resend OTP requested for email with no pending registration')
      return reply.status(404).send({ error: 'No pending registration found for this email.' })
    }

    if (pendingRegistration.consumedAt) {
      request.log.warn({ email }, 'Resend OTP requested for already consumed registration')
      return reply.status(400).send({ error: 'This registration has already been verified. Continue to payment or sign in.' })
    }

    if (pendingRegistration.status === 'CONSUMED') {
      request.log.warn({ email }, 'Resend OTP requested for consumed OTP record')
      return reply.status(400).send({ error: 'This OTP has already been used. Continue to payment or register again.' })
    }

    if (pendingRegistration.resendCount >= 5) {
      request.log.warn({ email, resendCount: pendingRegistration.resendCount }, 'Resend OTP limit reached')
      return reply.status(429).send({ error: 'Too many resend attempts. Please wait before requesting another OTP.' })
    }

    const otpCode = createNumericOtp(6)
    const otpHash = hashOtp(otpCode)
    const otpExpiresAt = getRegistrationOtpExpiry()

    await (prisma as any).pendingRegistration.update({
      where: { email },
      data: {
        otpHash,
        otpExpiresAt,
        otpSentAt: new Date(),
        resendCount: pendingRegistration.resendCount + 1,
        otpVerifiedAt: null,
        consumedAt: null,
        status: 'PENDING_OTP'
      }
    })

    try {
      const info = await sendRegistrationOtpEmail({
        email,
        otpCode,
        firstName: pendingRegistration.directorFirstName,
        schoolName: pendingRegistration.schoolName,
        expiresInMinutes: getRegistrationOtpMinutes()
      })

      request.log.info({
        email,
        messageId: info?.messageId || null
      }, 'Registration OTP resend email sent successfully')
    } catch (mailError: any) {
      request.log.error({
        email,
        error: mailError?.message || String(mailError)
      }, 'Failed to resend registration OTP email')

      return reply.status(502).send({
        error: 'Failed to resend OTP email. Please try again shortly.'
      })
    }

    request.log.info({
      email,
      otpExpiresAt,
      resendCount: pendingRegistration.resendCount + 1,
      otpHashPreview: otpHash.slice(0, 12)
    }, 'Resent registration OTP and replaced the previous OTP')

    return reply.send({
      message: 'A new OTP has been sent.',
      expiresAt: otpExpiresAt
    })
  } catch (error: any) {
    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Invalid email' })
    }
    return reply.status(500).send({ error: 'Failed to resend OTP' })
  }
}

export const verifyRegistrationOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parsed = verifyRegistrationOtpSchema.parse(request.body)
    const email = normalizeEmail(parsed.email)
    const otpCode = normalizeOtpCode(parsed.otpCode || parsed.code || '')
    const otpHash = hashOtp(otpCode)

    const existingUser = await prisma.user.findFirst({ where: { email } })
    if (existingUser) {
      request.log.warn({ email }, 'OTP verification attempted for already registered email')
      return reply.status(400).send({ error: 'This email is already registered. Please sign in instead.' })
    }

    const pendingRegistration = await (prisma as any).pendingRegistration.findUnique({
      where: { email }
    })

    if (!pendingRegistration) {
      request.log.warn({ email }, 'OTP verification failed because no pending registration was found')
      return reply.status(404).send({ error: 'No pending registration found for this email.' })
    }

    if (pendingRegistration.consumedAt || pendingRegistration.status === 'CONSUMED') {
      request.log.warn({ email }, 'OTP verification attempted for already consumed registration')
      return reply.status(400).send({ error: 'This OTP has already been used. Continue to payment or request a fresh registration.' })
    }

    if (pendingRegistration.otpExpiresAt < new Date()) {
      await (prisma as any).pendingRegistration.update({
        where: { email },
        data: { status: 'EXPIRED' }
      })
      request.log.warn({
        email,
        expiresAt: pendingRegistration.otpExpiresAt
      }, 'OTP verification failed because the OTP expired')
      return reply.status(400).send({ error: 'OTP has expired. Request a new one to continue.' })
    }

    if (pendingRegistration.otpHash !== otpHash) {
      request.log.warn({
        email,
        submittedOtpHashPreview: otpHash.slice(0, 12),
        storedOtpHashPreview: String(pendingRegistration.otpHash).slice(0, 12)
      }, 'OTP verification failed because the submitted OTP did not match')
      return reply.status(400).send({ error: 'OTP is incorrect. Please check the latest code and try again.' })
    }

    request.log.info({ email }, 'OTP verified successfully. Initializing payment flow.')
    const initialized = await initializeVerifiedRegistration(pendingRegistration)
    emitAdminSchoolsUpdated('school:registered')

    return reply.send({
      message: initialized.authorization_url
        ? 'Email verified successfully. Redirecting to payment.'
        : 'Email verified successfully. Payment gateway is temporarily unavailable. Use the payment-required page to continue.',
      email,
      authorization_url: initialized.authorization_url,
      reference: initialized.reference
    })
  } catch (error: any) {
    console.error('Verify registration OTP error:', error)
    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }
    if (isSqliteDiskIoError(error)) {
      return reply.status(503).send({
        error: 'Database storage is temporarily unavailable (disk I/O issue). Please retry shortly.'
      })
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Validation failed' })
    }
    return reply.status(500).send({ error: 'Failed to verify OTP' })
  }
}

export const verifyEmail = async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.status(410).send({
    error: 'Email link verification has been replaced with OTP verification during registration.'
  })
}

export const forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email } = emailSchema.parse(request.body)
    const matchingUsers = await resolveUsersByEmail(email, request.schoolHint)
    const genericMessage = 'If an account with that email exists, a password reset link has been sent.'

    if (matchingUsers.length !== 1) {
      return reply.send({ message: genericMessage })
    }

    const user = matchingUsers[0]

    const reset = await createPasswordResetToken(user.id)
    try {
      await sendPasswordResetEmail({
        email,
        firstName: user.firstName || 'User',
        resetUrl: reset.resetUrl,
        expiresInMinutes: getPasswordResetTokenMinutes(),
      })

      request.log.info({
        email,
        userId: user.id,
      }, 'Password reset email sent successfully')
    } catch (mailError: any) {
      request.log.error({
        email,
        userId: user.id,
        error: mailError?.message || String(mailError),
      }, 'Failed to send password reset email')

      await (prisma as any).passwordResetToken.deleteMany({
        where: { userId: user.id }
      })
    }

    return reply.send({ message: genericMessage })
  } catch (error: any) {
    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Invalid email' })
    }
    return reply.status(500).send({ error: 'Failed to start password reset flow' })
  }
}

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { token, password } = resetPasswordSchema.parse(request.body)
    const tokenHash = hashToken(token)

    const record = await (prisma as any).passwordResetToken.findUnique({
      where: { tokenHash }
    })

    if (!record || record.expiresAt < new Date()) {
      if (record) {
        await (prisma as any).passwordResetToken.delete({ where: { id: record.id } })
      }
      return reply.status(400).send({ error: 'Reset token is invalid or expired' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword }
      }),
      (prisma as any).passwordResetToken.deleteMany({
        where: { userId: record.userId }
      })
    ])

    return reply.send({ message: 'Password reset successfully' })
  } catch (error: any) {
    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Validation failed' })
    }
    return reply.status(500).send({ error: 'Failed to reset password' })
  }
}

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, password } = loginSchema.parse(request.body)

    const matchingUsers = await resolveUsersByEmail(email, request.schoolHint)
    const user: any = matchingUsers.length === 1 ? matchingUsers[0] : null

    if (!user) {
      const pendingRegistration = await (prisma as any).pendingRegistration.findUnique({
        where: { email }
      })

      if (pendingRegistration && !pendingRegistration.consumedAt) {
        return reply.status(403).send({
          code: 'EMAIL_VERIFICATION_REQUIRED',
          error: 'Please verify your email with the OTP we sent before continuing.',
          email
        })
      }

      if (matchingUsers.length > 1) {
        return reply.status(409).send({
          code: 'TENANT_CONTEXT_REQUIRED',
          error: 'Multiple school accounts use this email. Please sign in from the correct school portal.'
        })
      }

      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const refreshedUser: any = await prisma.user.findUnique({
      where: { id: user.id },
      include: { school: true }
    })

    if (!refreshedUser) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const subscriptionState = await ensureSchoolSubscriptionState(refreshedUser.schoolId)
    const hasActiveSubscription = Boolean(subscriptionState?.activeSubscription)
    const hasActiveTrial = Boolean(subscriptionState?.trial?.isActive)
    const hasActiveAccess = hasActiveSubscription || hasActiveTrial
    const isSuperAdmin = refreshedUser.role === 'SUPERADMIN'
    const accessState = deriveSchoolAccessState({
      schoolStatus: refreshedUser.school.status,
      hasActiveSubscription,
      hasActiveTrial,
    })

    if (refreshedUser.role === 'DIRECTOR' && !refreshedUser.emailVerifiedAt) {
      return reply.status(403).send({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        error: 'Please verify your email before signing in.',
        email: refreshedUser.email
      })
    }

    if (!isSuperAdmin && refreshedUser.school.status === 'PENDING_PAYMENT') {
      return reply.status(403).send({
        code: 'PAYMENT_REQUIRED',
        error: 'Your school registration payment is pending. Please complete the registration fee.',
        email: refreshedUser.email
      })
    }

    if (!isSuperAdmin && refreshedUser.school.status === 'EXPIRED' && refreshedUser.role !== 'DIRECTOR') {
      return reply.status(403).send({
        code: 'SUBSCRIPTION_EXPIRED',
        error: 'Your school subscription has expired. Please contact the Director to renew access.'
      })
    }

    if (!isSuperAdmin && !hasActiveAccess && refreshedUser.role !== 'DIRECTOR') {
      return reply.status(403).send({
        code: 'SUBSCRIPTION_REQUIRED',
        error: 'A school term subscription is required once the trial period ends before this account can access advanced modules.'
      })
    }

    if (!isSuperAdmin && refreshedUser.school.status === 'SUSPENDED') {
      return reply.status(403).send({ error: 'Your school account has been suspended. Contact support.' })
    }

    const sessionUser: any = await prisma.user.update({
      where: { id: refreshedUser.id },
      data: { lastLoginAt: new Date() },
      include: { school: true },
    })

    const token = signAuthToken(reply, {
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      schoolId: sessionUser.schoolId
    })

    emitAdminUsersUpdated('user:login')

    return {
      token,
      user: mapUserForAuth(sessionUser, {
        accessState,
        hasActiveSubscription,
        hasActiveTrial,
      })
    }
  } catch (error: any) {
    request.log.error({
      err: error,
      message: error?.message,
      code: error?.code,
      name: error?.name,
      stack: error?.stack,
    }, 'Login failed')

    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }

    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Validation failed' })
    }
    return reply.status(500).send({ error: 'Failed to sign in' })
  }
}

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const decoded = await request.jwtVerify<{ id: string; schoolId: string }>()
    const subscriptionState = await ensureSchoolSubscriptionState(decoded.schoolId)

    const user: any = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { school: true }
    })

    if (!user || user.deletedAt) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const hasActiveSubscription = Boolean(subscriptionState?.activeSubscription)
    const hasActiveTrial = Boolean(subscriptionState?.trial?.isActive)
    const accessState = deriveSchoolAccessState({
      schoolStatus: user.school.status,
      hasActiveSubscription,
      hasActiveTrial,
    })

    return mapUserForAuth(user, {
      accessState,
      hasActiveSubscription,
      hasActiveTrial,
    })
  } catch (error: any) {
    if (error?.statusCode === 401 || /jwt/i.test(String(error?.name || ''))) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const dbErrorMessage = getDatabaseErrorMessage(error)
    if (dbErrorMessage) {
      return reply.status(503).send({ error: dbErrorMessage })
    }

    return reply.status(500).send({ error: 'Failed to refresh session' })
  }
}
