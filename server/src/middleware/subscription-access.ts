import { FastifyRequest, FastifyReply } from 'fastify'
import { deriveSchoolAccessState, ensureSchoolSubscriptionState } from '../utils/subscription.js'
import prisma from '../db/prisma.js'

const DIRECTOR_ALLOWED_PREFIXES = [
  '/api/auth/me',
  '/api/dashboard/summary',
  '/api/payments/subscription/status',
  '/api/payments/subscription/initialize',
  '/api/payments/reinitialize',
  '/api/payments/verify/',
  '/api/settings/school',
  '/api/settings/password',
]

const GENERAL_ALLOWED_PREFIXES = [
  '/api/auth/me',
]

function isAllowedPath(url: string, prefixes: string[]) {
  return prefixes.some(prefix => url.startsWith(prefix))
}

export const subscriptionAccessGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as any).user as { role?: string; schoolId?: string } | undefined

  if (user?.role === 'SUPERADMIN') {
    return
  }

  if (!user?.schoolId || !user.role) {
    return
  }

  const account = await prisma.user.findUnique({
    where: { id: (user as any).id },
    select: { deletedAt: true }
  })

  if (!account || account.deletedAt) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const state = await ensureSchoolSubscriptionState(user.schoolId)

  if (!state) {
    return
  }

  const accessState = deriveSchoolAccessState({
    schoolStatus: state.school.status,
    hasActiveSubscription: Boolean(state.activeSubscription),
    hasActiveTrial: Boolean(state.trial?.isActive),
  })

  if (accessState === 'ACTIVE' || accessState === 'PENDING_PAYMENT') {
    return
  }

  const url = request.url

  if (user.role === 'DIRECTOR' && isAllowedPath(url, DIRECTOR_ALLOWED_PREFIXES)) {
    return
  }

  if (user.role !== 'DIRECTOR' && isAllowedPath(url, GENERAL_ALLOWED_PREFIXES)) {
    return
  }

  const code = accessState === 'EXPIRED' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_REQUIRED'

  return reply.status(403).send({
    code,
    error: user.role === 'DIRECTOR'
      ? accessState === 'EXPIRED'
        ? 'Your school subscription has expired. Renew the term plan to continue.'
        : 'Your school trial has ended, and a term subscription is required to unlock advanced features.'
      : accessState === 'EXPIRED'
        ? 'Your school subscription has expired. Please contact the Director to renew access.'
        : 'Your school trial has ended and a term subscription is required. Please contact the Director.',
  })
}
