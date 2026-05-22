import prisma from '../db/prisma.js'

export const SUBSCRIPTION_TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'] as const
export type SubscriptionTerm = (typeof SUBSCRIPTION_TERM_OPTIONS)[number]
export const REGISTRATION_FEE_NAIRA = parseFloat(
  process.env.REGISTRATION_FEE_NAIRA || String((parseInt(process.env.REGISTRATION_FEE_KOBO || '500000', 10) || 500000) / 100)
)

const TERM_PRICES_NAIRA: Record<SubscriptionTerm, number> = {
  'First Term': 75000,
  'Second Term': 100000,
  'Third Term': 110000,
}

export function getAllTermPricesNaira() {
  return { ...TERM_PRICES_NAIRA }
}

export const SUBSCRIPTION_TERM_DAYS = parseInt(process.env.SUBSCRIPTION_TERM_DAYS || '120', 10)
export const SCHOOL_TRIAL_DAYS = parseInt(process.env.SCHOOL_TRIAL_DAYS || '7', 10)
export const DEFAULT_SUBSCRIPTION_TERM: SubscriptionTerm = 'First Term'

export type SchoolAccessState =
  | 'PENDING_PAYMENT'
  | 'SUBSCRIPTION_REQUIRED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'

export function getPriceForTermNaira(termName: string): number {
  return TERM_PRICES_NAIRA[termName as SubscriptionTerm] || TERM_PRICES_NAIRA['First Term']
}

export function getPriceForTermKobo(termName: string): number {
  return Math.round(getPriceForTermNaira(termName) * 100)
}

export function getRegistrationFeeKobo(): number {
  return Math.round(REGISTRATION_FEE_NAIRA * 100)
}

export function isValidSubscriptionTerm(termName: string) {
  return SUBSCRIPTION_TERM_OPTIONS.includes(termName as (typeof SUBSCRIPTION_TERM_OPTIONS)[number])
}

export function calculateSubscriptionWindow(referenceDate?: Date) {
  const startDate = referenceDate ? new Date(referenceDate) : new Date()
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + SUBSCRIPTION_TERM_DAYS)

  return { startDate, endDate }
}

export function deriveSchoolAccessState(params: {
  schoolStatus?: string | null
  hasActiveSubscription: boolean
  hasActiveTrial?: boolean
}): SchoolAccessState {
  const schoolStatus = params.schoolStatus || null

  if (schoolStatus === 'PENDING_PAYMENT') return 'PENDING_PAYMENT'
  if (schoolStatus === 'SUSPENDED') return 'SUSPENDED'
  if (params.hasActiveTrial) return 'ACTIVE'
  if (params.hasActiveSubscription) return 'ACTIVE'
  if (schoolStatus === 'EXPIRED') return 'EXPIRED'

  return 'SUBSCRIPTION_REQUIRED'
}

export async function ensureSchoolSubscriptionState(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: {
      payments: {
        where: {
          type: 'REGISTRATION',
          status: 'SUCCESS',
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      subscriptions: {
        orderBy: [
          { endDate: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 5,
      },
    },
  })

  if (!school) {
    return null
  }

  const now = new Date()
  const activeSubscription = school.subscriptions.find(
    subscription => subscription.status === 'ACTIVE' && subscription.endDate > now
  ) || null

  const staleActiveSubscriptions = school.subscriptions.filter(
    subscription => subscription.status === 'ACTIVE' && subscription.endDate <= now
  )

  if (staleActiveSubscriptions.length > 0) {
    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { id: { in: staleActiveSubscriptions.map(subscription => subscription.id) } },
        data: { status: 'EXPIRED' },
      }),
      prisma.school.update({
        where: { id: schoolId },
        data: { status: 'EXPIRED' },
      }),
    ])

    return ensureSchoolSubscriptionState(schoolId)
  }

  if (activeSubscription && school.status !== 'ACTIVE') {
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: 'ACTIVE' },
    })

    return ensureSchoolSubscriptionState(schoolId)
  }

  const latestSubscription = school.subscriptions[0] || null
  const latestEndedSubscription = school.subscriptions.find(subscription => subscription.endDate <= now) || null
  const trialStartAt = school.payments[0]?.createdAt || school.createdAt
  const trialEndsAt = new Date(trialStartAt)
  trialEndsAt.setDate(trialEndsAt.getDate() + SCHOOL_TRIAL_DAYS)
  const hasActiveTrial =
    school.status === 'ACTIVE' &&
    !activeSubscription &&
    trialEndsAt > now

  if (!activeSubscription && latestEndedSubscription && school.status !== 'EXPIRED' && !hasActiveTrial) {
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: 'EXPIRED' },
    })

    return ensureSchoolSubscriptionState(schoolId)
  }

  return {
    school,
    activeSubscription,
    latestSubscription,
    trial: {
      days: SCHOOL_TRIAL_DAYS,
      startsAt: trialStartAt,
      endsAt: trialEndsAt,
      isActive: hasActiveTrial,
    },
    isExpired: !activeSubscription && latestSubscription?.status === 'EXPIRED',
  }
}
