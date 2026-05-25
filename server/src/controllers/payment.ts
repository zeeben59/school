import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../db/prisma.js'
import axios from 'axios'
import { emitAdminSubscriptionsUpdated } from './admin.js'
import {
  calculateSubscriptionWindow,
  deriveSchoolAccessState,
  ensureSchoolSubscriptionState,
  isValidSubscriptionTerm,
  getAllTermPricesNaira,
  getPriceForTermNaira,
  getPriceForTermKobo,
  getRegistrationFeeKobo,
  REGISTRATION_FEE_NAIRA,
  DEFAULT_SUBSCRIPTION_TERM,
  SUBSCRIPTION_TERM_OPTIONS,
} from '../utils/subscription.js'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

function requirePaystackSecretKey() {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is required')
  }
  return PAYSTACK_SECRET_KEY
}

function getPaystackCallbackUrl() {
  const configured = process.env.PAYSTACK_CALLBACK_URL
  if (configured) {
    return configured
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PAYSTACK_CALLBACK_URL is required in production')
  }

  return 'http://localhost:5173/payment/verify'
}

type PaystackMetadata = {
  schoolId: string
  userId: string
  paymentFor: 'SUBSCRIPTION' | 'REGISTRATION'
  termName?: string
}

async function buildDirectorAuthPayload(schoolId: string) {
  const subscriptionState = await ensureSchoolSubscriptionState(schoolId)

  const director: any = await prisma.user.findFirst({
    where: { schoolId, role: 'DIRECTOR' },
    include: { school: true }
  })

  if (!director) {
    return { token: null, user: null }
  }

  const hasActiveSubscription = Boolean(subscriptionState?.activeSubscription)
  const hasActiveTrial = Boolean(subscriptionState?.trial?.isActive)
  const accessState = deriveSchoolAccessState({
    schoolStatus: director.school.status,
    hasActiveSubscription,
    hasActiveTrial,
  })

  const user = {
    id: director.id,
    email: director.email,
    firstName: director.firstName,
    lastName: director.lastName,
    role: director.role,
    school: director.school.name,
    schoolId: director.schoolId,
    status: director.school.status,
    logoUrl: director.school.logoUrl,
    phone: director.school.phone,
    address: director.school.address,
    emailVerifiedAt: director.emailVerifiedAt || null,
    mustChangePassword: Boolean(director.mustChangePassword),
    hasActiveSubscription,
    hasActiveTrial,
    accessState,
  }

  return { token: null, user }
}

export const initializePaystackPayment = async (
  schoolId: string,
  userId: string,
  email: string,
  amountKobo: number,
  reference: string,
  metadata: Omit<PaystackMetadata, 'schoolId' | 'userId'> = {
    paymentFor: 'SUBSCRIPTION',
    termName: DEFAULT_SUBSCRIPTION_TERM,
  }
) => {
  try {
    const paystackSecret = requirePaystackSecretKey()
    const callbackUrl = getPaystackCallbackUrl()
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amountKobo,
        callback_url: callbackUrl,
        reference,
        metadata: {
          schoolId,
          userId,
          ...metadata,
        }
      },
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return response.data.data
  } catch (error: any) {
    console.error('Paystack Initialization Error:', error.response?.data || error.message)
    throw new Error('Failed to initialize payment gateway')
  }
}

async function createOrRenewSubscription(paymentRecord: any, termName: string) {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { paymentReference: paymentRecord.reference }
  })

  if (existingSubscription) {
    return existingSubscription
  }

  const { startDate, endDate } = calculateSubscriptionWindow(new Date())

  const [subscription] = await prisma.$transaction([
    prisma.subscription.create({
      data: {
        schoolId: paymentRecord.schoolId,
        planName: 'TERM_SUBSCRIPTION',
        termName,
        amount: getPriceForTermNaira(termName),
        startDate,
        endDate,
        status: 'ACTIVE',
        paymentReference: paymentRecord.reference,
      },
    }),
    prisma.school.update({
      where: { id: paymentRecord.schoolId },
      data: { status: 'ACTIVE' }
    })
  ])

  return subscription
}

async function activateRegistration(paymentRecord: any) {
  await prisma.school.update({
    where: { id: paymentRecord.schoolId },
    data: { status: 'ACTIVE' }
  })
}

async function applyPaymentSuccessEffects(paymentRecord: any, termName: string) {
  if (paymentRecord.type === 'SUBSCRIPTION') {
    await createOrRenewSubscription(paymentRecord, termName)
    return
  }

  if (paymentRecord.type === 'REGISTRATION') {
    await activateRegistration(paymentRecord)
    return
  }

  throw new Error('Unsupported payment type')
}

export const verifyPayment = async (request: FastifyRequest, reply: FastifyReply) => {
  const { reference } = request.params as { reference: string }

  try {
    const paystackSecret = requirePaystackSecretKey()
    const paymentRecord = await prisma.payment.findUnique({
      where: { reference }
    })

    if (!paymentRecord) {
      return reply.status(404).send({ error: 'Payment record not found' })
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`
        }
      }
    )

    const { status, amount, currency, metadata, reference: gatewayReference } = response.data.data
    const paystackMetadata = metadata as Partial<PaystackMetadata> | undefined
    const schoolId = paystackMetadata?.schoolId || paymentRecord.schoolId
    const paymentType = paymentRecord.type
    const paymentTermName = paystackMetadata?.termName || DEFAULT_SUBSCRIPTION_TERM

    if (gatewayReference && gatewayReference !== reference) {
      return reply.status(400).send({ error: 'Payment reference mismatch' })
    }

    if (status !== 'success') {
      return reply.status(400).send({ error: 'Payment not successful' })
    }

    if (paystackMetadata?.schoolId && paystackMetadata.schoolId !== paymentRecord.schoolId) {
      return reply.status(400).send({ error: 'Payment metadata school mismatch' })
    }

    if (paymentType === 'SUBSCRIPTION' && !isValidSubscriptionTerm(paymentTermName)) {
      return reply.status(400).send({ error: 'Invalid subscription term in payment metadata' })
    }

    if (paystackMetadata?.paymentFor && paystackMetadata.paymentFor !== paymentType) {
      return reply.status(400).send({ error: 'Payment metadata type mismatch' })
    }

    const expectedAmountKobo = paymentType === 'SUBSCRIPTION'
      ? getPriceForTermKobo(paymentTermName)
      : getRegistrationFeeKobo()

    const recordedAmountKobo = Math.round(paymentRecord.amount * 100)
    if (recordedAmountKobo !== expectedAmountKobo) {
      return reply.status(400).send({ error: 'Stored payment amount does not match expected pricing rules' })
    }

    if (amount !== expectedAmountKobo) {
      return reply.status(400).send({ error: 'Invalid payment amount' })
    }

    if (currency !== 'NGN') {
      return reply.status(400).send({ error: 'Invalid currency' })
    }

    if (paymentRecord.status === 'SUCCESS') {
      await applyPaymentSuccessEffects(paymentRecord, paymentTermName)

      await ensureSchoolSubscriptionState(paymentRecord.schoolId)
      emitAdminSubscriptionsUpdated('subscription:verified')

      const { token, user } = await buildDirectorAuthPayload(paymentRecord.schoolId)
      return reply.status(200).send({
        message: paymentType === 'REGISTRATION'
          ? 'Registration payment already verified.'
          : 'Subscription payment already verified.',
        schoolId,
        paymentType,
        token,
        user
      })
    }

    if (paymentRecord.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Payment is not in pending state' })
    }

    const transition = await prisma.payment.updateMany({
      where: { id: paymentRecord.id, status: 'PENDING' },
      data: { status: 'SUCCESS' }
    })

    if (transition.count === 0) {
      await applyPaymentSuccessEffects(paymentRecord, paymentTermName)
      await ensureSchoolSubscriptionState(paymentRecord.schoolId)
      emitAdminSubscriptionsUpdated('subscription:verified')
      const { token, user } = await buildDirectorAuthPayload(paymentRecord.schoolId)
      return reply.status(200).send({
        message: paymentType === 'REGISTRATION'
          ? 'Registration payment already verified.'
          : 'Subscription payment already verified.',
        schoolId,
        paymentType,
        token,
        user
      })
    }

    await applyPaymentSuccessEffects(paymentRecord, paymentTermName)
    await ensureSchoolSubscriptionState(paymentRecord.schoolId)
    emitAdminSubscriptionsUpdated('subscription:verified')
    const { token, user } = await buildDirectorAuthPayload(paymentRecord.schoolId)

    return reply.status(200).send({
      message: paymentType === 'REGISTRATION'
        ? 'Registration payment verified successfully. Your school is now active.'
        : 'Subscription activated successfully',
      schoolId,
      paymentType,
      token,
      user,
    })
  } catch (error: any) {
    const statusCode = error.response?.status
    const gatewayMessage =
      error.response?.data?.message ||
      error.response?.data?.data?.gateway_response ||
      error.message

    console.error('Payment Verification Error:', error.response?.data || error.message)

    if (statusCode === 404) {
      return reply.status(404).send({ error: 'Payment reference not found or invalid' })
    }

    if (statusCode === 400) {
      return reply.status(400).send({ error: gatewayMessage || 'Payment verification failed' })
    }

    return reply.status(500).send({ error: 'Internal server error during verification' })
  }
}

function mapSubscriptionSummary(subscriptionState: Awaited<ReturnType<typeof ensureSchoolSubscriptionState>>) {
  if (!subscriptionState) {
    return null
  }

  const current = subscriptionState.activeSubscription || subscriptionState.latestSubscription
  const hasActiveSubscription = Boolean(subscriptionState.activeSubscription)
  const hasActiveTrial = Boolean(subscriptionState.trial?.isActive)
  const accessState = deriveSchoolAccessState({
    schoolStatus: subscriptionState.school.status,
    hasActiveSubscription,
    hasActiveTrial,
  })

  return {
    schoolStatus: subscriptionState.school.status,
    accessState,
    hasActiveSubscription,
    hasActiveTrial,
    currentStatus: current?.status || subscriptionState.latestSubscription?.status || 'INACTIVE',
    activeTerm: current?.termName || null,
    price: current?.amount || getPriceForTermNaira(current?.termName || DEFAULT_SUBSCRIPTION_TERM),
    termPrices: getAllTermPricesNaira(),
    expiryDate: current?.endDate || null,
    startDate: current?.startDate || null,
    paymentReference: current?.paymentReference || null,
    availableTerms: [...SUBSCRIPTION_TERM_OPTIONS],
    trial: subscriptionState.trial || null,
  }
}

export const getSubscriptionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const decoded = await request.jwtVerify<{ id: string; schoolId: string; role: string }>()
    const subscriptionState = await ensureSchoolSubscriptionState(decoded.schoolId)

    if (!subscriptionState) {
      return reply.status(404).send({ error: 'School not found' })
    }

    return reply.send(mapSubscriptionSummary(subscriptionState))
  } catch (error) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export const initializeSubscriptionPayment = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const decoded = await request.jwtVerify<{ id: string; schoolId: string; role: string }>()

    if (decoded.role !== 'DIRECTOR') {
      return reply.status(403).send({ error: 'Only the Director can manage subscriptions.' })
    }

    const { termName } = (request.body || {}) as { termName?: string }

    if (!termName || !isValidSubscriptionTerm(termName)) {
      return reply.status(400).send({ error: 'Please choose a valid school term.' })
    }

    const director: any = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { school: true }
    })

    if (!director || director.role !== 'DIRECTOR') {
      return reply.status(404).send({ error: 'Director account not found.' })
    }

    const reference = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const paystackData = await initializePaystackPayment(
      director.schoolId,
      director.id,
      director.email,
      getPriceForTermKobo(termName),
      reference,
      {
        paymentFor: 'SUBSCRIPTION',
        termName,
      }
    )

    await prisma.payment.create({
      data: {
        amount: getPriceForTermNaira(termName),
        status: 'PENDING',
        reference: paystackData.reference,
        schoolId: director.schoolId,
        type: 'SUBSCRIPTION'
      }
    })

    return reply.send({
      authorization_url: paystackData.authorization_url,
      reference: paystackData.reference,
      amount: getPriceForTermNaira(termName),
      termName,
    })
  } catch (error: any) {
    console.error('Subscription initialization error:', error.message)
    return reply.status(500).send({ error: 'Failed to initialize subscription payment' })
  }
}

export const reinitializePayment = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email } = request.body as { email: string }

    const matchingUsers: any[] = await prisma.user.findMany({
      where: {
        email,
        role: 'DIRECTOR',
        ...(request.schoolHint ? { schoolId: request.schoolHint } : {}),
        deletedAt: null
      },
      include: { school: true }
    })

    const user: any = matchingUsers.length === 1 ? matchingUsers[0] : null

    if (!user && matchingUsers.length > 1) {
      return reply.status(409).send({ error: 'Multiple director accounts use this email. Reinitialize payment from the correct school portal.' })
    }

    if (!user || user.role !== 'DIRECTOR') {
      return reply.status(404).send({ error: 'Director account not found' })
    }

    if (!user.emailVerifiedAt) {
      return reply.status(403).send({ error: 'Please verify your email before reinitializing payment.' })
    }

    if (user.school.status !== 'PENDING_PAYMENT') {
      return reply.status(400).send({ error: 'School is already active, expired, or suspended' })
    }

    const reference = `REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const paystackData = await initializePaystackPayment(
      user.schoolId,
      user.id,
      email,
      getRegistrationFeeKobo(),
      reference,
      {
        paymentFor: 'REGISTRATION',
      }
    )

    await prisma.payment.create({
      data: {
        amount: REGISTRATION_FEE_NAIRA,
        status: 'PENDING',
        reference: paystackData.reference,
        schoolId: user.schoolId,
        type: 'REGISTRATION'
      }
    })

    return {
      authorization_url: paystackData.authorization_url,
      reference: paystackData.reference,
      amount: REGISTRATION_FEE_NAIRA,
      paymentType: 'REGISTRATION',
    }
  } catch (error: any) {
    console.error('Reinitialization Error:', error.message)
    return reply.status(500).send({ error: 'Failed to reinitialize payment' })
  }
}
