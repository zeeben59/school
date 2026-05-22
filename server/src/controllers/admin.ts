import { FastifyReply, FastifyRequest } from 'fastify'
import prisma from '../db/prisma.js'
import { calculateSubscriptionWindow, deriveSchoolAccessState, SCHOOL_TRIAL_DAYS } from '../utils/subscription.js'
import { emitAdminEvent, subscribeAdminEvents } from '../modules/admin/admin-events.js'
import { consumeAdminStreamToken, issueAdminStreamToken } from '../modules/admin/admin-realtime.service.js'

type SchoolSnapshot = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  logoUrl: string | null
  createdAt: Date
  subscriptions: Array<{
    id: string
    termName: string
    amount: number
    status: string
    startDate: Date
    endDate: Date
    paymentReference: string | null
    createdAt: Date
  }>
  payments: Array<{ createdAt: Date }>
  users: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  }>
  _count: {
    users: number
  }
}

const NEAR_EXPIRY_DAYS = 7
const ACTIVE_USER_WINDOW_DAYS = 30

function computeSchoolLifecycle(school: SchoolSnapshot) {
  const now = new Date()
  const activeSubscription =
    school.subscriptions.find(subscription => subscription.status === 'ACTIVE' && subscription.endDate > now) || null
  const latestSubscription = school.subscriptions[0] || null
  const trialStartAt = school.payments[0]?.createdAt || school.createdAt
  const trialEndsAt = new Date(trialStartAt)
  trialEndsAt.setDate(trialEndsAt.getDate() + SCHOOL_TRIAL_DAYS)
  const hasActiveTrial =
    school.status === 'ACTIVE' &&
    !activeSubscription &&
    trialEndsAt > now

  const accessState = deriveSchoolAccessState({
    schoolStatus: school.status,
    hasActiveSubscription: Boolean(activeSubscription),
    hasActiveTrial,
  })

  return {
    accessState,
    hasActiveTrial,
    trialEndsAt,
    activeSubscription,
    latestSubscription,
  }
}

function mapSchoolRow(school: SchoolSnapshot) {
  const lifecycle = computeSchoolLifecycle(school)
  const director = school.users.find(user => user.role === 'DIRECTOR') || null

  return {
    id: school.id,
    name: school.name,
    email: school.email,
    phone: school.phone,
    logoUrl: school.logoUrl,
    status: school.status,
    createdAt: school.createdAt,
    totalUsers: school._count.users,
    accessState: lifecycle.accessState,
    trial: {
      isActive: lifecycle.hasActiveTrial,
      endsAt: lifecycle.trialEndsAt,
      days: SCHOOL_TRIAL_DAYS,
    },
    subscription: {
      hasActive: Boolean(lifecycle.activeSubscription),
      activeTerm: lifecycle.activeSubscription?.termName || null,
      amount: lifecycle.activeSubscription?.amount || lifecycle.latestSubscription?.amount || null,
      status: lifecycle.activeSubscription?.status || lifecycle.latestSubscription?.status || 'INACTIVE',
      startDate: lifecycle.activeSubscription?.startDate || lifecycle.latestSubscription?.startDate || null,
      expiryDate: lifecycle.activeSubscription?.endDate || lifecycle.latestSubscription?.endDate || null,
      paymentReference:
        lifecycle.activeSubscription?.paymentReference || lifecycle.latestSubscription?.paymentReference || null,
    },
    director: director
      ? {
          id: director.id,
          fullName: `${director.firstName} ${director.lastName}`.trim(),
          email: director.email,
        }
      : null,
  }
}

async function getAdminContext(request: FastifyRequest, reply: FastifyReply) {
  // Allow tenant middleware to provide `request.user` (from Supabase token)
  const existingUser = (request as any).user
  if (existingUser) {
    if (existingUser.role !== 'SUPERADMIN') {
      reply.status(403).send({ error: 'Forbidden: Platform admin access only' })
      return null
    }
    return existingUser
  }

  // Fallback to Fastify JWT
  try {
    const decoded = await request.jwtVerify<{ id: string; role: string }>()
    if (decoded.role !== 'SUPERADMIN') {
      reply.status(403).send({ error: 'Forbidden: Platform admin access only' })
      return null
    }
    return decoded
  } catch {
    reply.status(401).send({ error: 'Unauthorized' })
    return null
  }
}

async function getSchoolSnapshots() {
  const schools = await prisma.school.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      logoUrl: true,
      createdAt: true,
      subscriptions: {
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          termName: true,
          amount: true,
          status: true,
          startDate: true,
          endDate: true,
          paymentReference: true,
          createdAt: true,
        },
      },
      payments: {
        where: { type: 'REGISTRATION', status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
      users: {
        where: { deletedAt: null, role: 'DIRECTOR' },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
      _count: {
        select: { users: true },
      },
    },
  })

  return schools
}

export const getAdminOverview = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const activeUserCutoff = new Date()
    activeUserCutoff.setDate(activeUserCutoff.getDate() - ACTIVE_USER_WINDOW_DAYS)
    const nearExpiryCutoff = new Date()
    nearExpiryCutoff.setDate(nearExpiryCutoff.getDate() + NEAR_EXPIRY_DAYS)

    const [
      schools,
      totalUsers,
      activeUsers,
      totalDirectors,
      totalPrincipals,
      totalTeachers,
      totalStudents,
      totalFeedback,
      totalSupportThreads,
      pendingSubscriptionApprovals,
      revenueAggregate,
      recentThreads,
      recentPayments,
    ] = await Promise.all([
      getSchoolSnapshots(),
      prisma.user.count({ where: { deletedAt: null, role: { not: 'SUPERADMIN' } } }),
      prisma.user.count({
        where: {
          deletedAt: null,
          role: { not: 'SUPERADMIN' },
          lastLoginAt: { gte: activeUserCutoff },
        },
      }),
      prisma.user.count({ where: { deletedAt: null, role: 'DIRECTOR' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'PRINCIPAL' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'TEACHER' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'STUDENT' } }),
      prisma.feedback.count(),
      prisma.supportThread.count(),
      prisma.subscription.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      prisma.supportThread.findMany({
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: {
          id: true,
          subject: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          amount: true,
          status: true,
          type: true,
          reference: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
      }),
    ])

    const rows = schools.map(mapSchoolRow)
    const activeSchools = rows.filter(school => school.status === 'ACTIVE').length
    const schoolsOnTrial = rows.filter(school => school.trial.isActive).length
    const activeSubscribedSchools = rows.filter(school => school.subscription.hasActive).length
    const expiredSchools = rows.filter(school => school.accessState === 'EXPIRED').length
    const nonSubscribedOrExpiredSchools = rows.filter(
      school => !school.subscription.hasActive || school.accessState === 'EXPIRED'
    ).length
    const schoolsNearingExpiry = rows.filter(row => {
      const expiryDate = row.subscription.expiryDate ? new Date(row.subscription.expiryDate) : null
      return Boolean(expiryDate && expiryDate > new Date() && expiryDate <= nearExpiryCutoff)
    })

    return reply.send({
      metrics: {
        totalSchools: rows.length,
        activeSchools,
        trialSchools: schoolsOnTrial,
        subscribedSchools: activeSubscribedSchools,
        nonSubscribedOrExpiredSchools,
        schoolsOnTrial,
        activeSubscribedSchools,
        expiredSchools,
        totalRegisteredUsers: totalUsers,
        activeUsers,
        totalDirectors,
        totalPrincipals,
        totalTeachers,
        totalStudents,
        totalFeedbackSubmissions: totalFeedback,
        totalSupportRequests: totalSupportThreads,
        totalSupportSubmissions: totalFeedback + totalSupportThreads,
        pendingSubscriptionApprovals,
        totalRevenue: revenueAggregate._sum.amount || 0,
      },
      recentSchoolRegistrations: rows.slice(0, 8),
      recentPayments,
      schoolsNearingExpiry: schoolsNearingExpiry.slice(0, 8),
      recentSupportActivity: recentThreads.map(thread => ({
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        createdAt: thread.createdAt,
        school: thread.school,
        owner: thread.user
          ? {
              id: thread.user.id,
              fullName: `${thread.user.firstName} ${thread.user.lastName}`.trim(),
              role: thread.user.role,
            }
          : null,
      })),
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load admin overview' })
  }
}

export const listAdminSchools = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const query = request.query as {
      q?: string
      status?: string
      accessState?: string
      page?: string
      pageSize?: string
    }

    const page = Math.max(1, Number(query.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))
    const search = (query.q || '').trim().toLowerCase()
    const statusFilter = (query.status || '').trim().toUpperCase()
    const accessStateFilter = (query.accessState || '').trim().toUpperCase()

    const schools = await getSchoolSnapshots()
    let rows = schools.map(mapSchoolRow)

    if (search) {
      rows = rows.filter(row =>
        [row.name, row.email || '', row.phone || '', row.director?.fullName || '', row.director?.email || '']
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    }

    if (statusFilter) {
      rows = rows.filter(row => row.status.toUpperCase() === statusFilter)
    }

    if (accessStateFilter) {
      rows = rows.filter(row => row.accessState.toUpperCase() === accessStateFilter)
    }

    const total = rows.length
    const start = (page - 1) * pageSize
    const paged = rows.slice(start, start + pageSize)

    return reply.send({
      page,
      pageSize,
      total,
      items: paged,
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load schools' })
  }
}

export const getAdminSchoolDetails = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }
    const school = await prisma.school.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        status: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: {
          orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          select: {
            id: true,
            termName: true,
            amount: true,
            status: true,
            startDate: true,
            endDate: true,
            paymentReference: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            reference: true,
            createdAt: true,
          },
        },
        users: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
          take: 100,
        },
        _count: {
          select: {
            users: true,
            students: true,
            staff: true,
            supportThreads: true,
            feedbackItems: true,
          },
        },
      },
    })

    if (!school) {
      return reply.status(404).send({ error: 'School not found' })
    }

    const lifecycle = computeSchoolLifecycle({
      ...school,
      payments: school.payments
        .filter(payment => payment.type === 'REGISTRATION' && payment.status === 'SUCCESS')
        .map(payment => ({ createdAt: payment.createdAt })),
      users: school.users.filter(user => user.role === 'DIRECTOR').map(user => ({ ...user, role: user.role })),
    })

    return reply.send({
      ...school,
      accessState: lifecycle.accessState,
      trial: {
        isActive: lifecycle.hasActiveTrial,
        endsAt: lifecycle.trialEndsAt,
        days: SCHOOL_TRIAL_DAYS,
      },
      subscription: {
        active: lifecycle.activeSubscription,
        latest: lifecycle.latestSubscription,
      },
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load school details' })
  }
}

export const getAdminSubscriptions = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const query = request.query as { group?: string }
    const group = (query.group || '').toLowerCase()

    const [schools, recentPayments, pendingSubscriptions, revenueAggregate] = await Promise.all([
      getSchoolSnapshots(),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          amount: true,
          status: true,
          reference: true,
          type: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
      }),
      prisma.subscription.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          schoolId: true,
          planName: true,
          termName: true,
          amount: true,
          status: true,
          startDate: true,
          endDate: true,
          paymentReference: true,
          createdAt: true,
          school: { select: { id: true, name: true, status: true } },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
    ])

    const allRows = schools.map(mapSchoolRow)
    let rows = allRows
    if (group === 'trial') rows = rows.filter(row => row.trial.isActive)
    if (group === 'active') rows = rows.filter(row => row.subscription.hasActive)
    if (group === 'expired') rows = rows.filter(row => row.accessState === 'EXPIRED')

    return reply.send({
      summary: {
        schoolsOnTrial: allRows.filter(row => row.trial.isActive).length,
        activePaidSchools: allRows.filter(row => row.subscription.hasActive).length,
        expiredSchools: allRows.filter(row => row.accessState === 'EXPIRED').length,
        pendingSubscriptionApprovals: pendingSubscriptions.length,
        totalRevenue: revenueAggregate._sum.amount || 0,
      },
      schools: rows,
      recentPayments,
      pendingSubscriptions,
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load subscription overview' })
  }
}

export const updateAdminSubscriptionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }
    const body = request.body as { action?: 'APPROVE' | 'REJECT' }

    if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
      return reply.status(400).send({ error: 'Invalid action. Use APPROVE or REJECT.' })
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    })

    if (!subscription) {
      return reply.status(404).send({ error: 'Subscription request not found' })
    }

    if (body.action === 'APPROVE') {
      if (subscription.status === 'ACTIVE') {
        return reply.send({ message: 'Subscription is already approved', subscription })
      }
      if (subscription.status !== 'PENDING') {
        return reply.status(400).send({ error: `Cannot approve subscription with status ${subscription.status}` })
      }

      const now = new Date()
      const needsDateReset = subscription.endDate <= now
      const window = needsDateReset ? calculateSubscriptionWindow(now) : null

      const updated = await prisma.$transaction(async tx => {
        const next = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            ...(window
              ? {
                  startDate: window.startDate,
                  endDate: window.endDate,
                }
              : {}),
          },
          select: {
            id: true,
            schoolId: true,
            status: true,
            termName: true,
            paymentReference: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
          },
        })

        await tx.school.update({
          where: { id: subscription.schoolId },
          data: { status: 'ACTIVE' },
        })

        return next
      })

      emitAdminSubscriptionsUpdated('subscription:approved')
      return reply.send({ message: 'Subscription approved successfully', subscription: updated })
    }

    if (subscription.status === 'CANCELLED') {
      return reply.send({ message: 'Subscription is already rejected', subscription })
    }
    if (subscription.status === 'ACTIVE') {
      return reply.status(400).send({ error: 'Cannot reject an active subscription.' })
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED' },
      select: {
        id: true,
        schoolId: true,
        status: true,
        termName: true,
        paymentReference: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    })

    emitAdminSubscriptionsUpdated('subscription:rejected')
    return reply.send({ message: 'Subscription rejected successfully', subscription: updated })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to update subscription status' })
  }
}

export const listAdminSupport = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const query = request.query as {
      view?: 'all' | 'feedback' | 'threads'
      feedbackStatus?: 'NEW' | 'REVIEWED' | 'CLOSED'
      threadStatus?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
      q?: string
    }

    const view = query.view || 'all'
    const search = (query.q || '').trim().toLowerCase()

    const [feedback, threads] = await Promise.all([
      view === 'threads'
        ? Promise.resolve([])
        : prisma.feedback.findMany({
            where: query.feedbackStatus ? { status: query.feedbackStatus } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
              id: true,
              category: true,
              message: true,
              rating: true,
              status: true,
              role: true,
              createdAt: true,
              updatedAt: true,
              school: { select: { id: true, name: true } },
              user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
            },
          }),
      view === 'feedback'
        ? Promise.resolve([])
        : prisma.supportThread.findMany({
            where: query.threadStatus ? { status: query.threadStatus } : undefined,
            orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
            take: 100,
            select: {
              id: true,
              subject: true,
              status: true,
              role: true,
              createdAt: true,
              updatedAt: true,
              lastMessageAt: true,
              school: { select: { id: true, name: true } },
              user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, content: true, senderType: true, createdAt: true },
              },
              _count: { select: { messages: true } },
            },
          }),
    ])

    const filteredFeedback = !search
      ? feedback
      : feedback.filter(item =>
          [item.category, item.message, item.school.name, item.user.email, item.user.firstName, item.user.lastName]
            .join(' ')
            .toLowerCase()
            .includes(search)
        )

    const filteredThreads = !search
      ? threads
      : threads.filter(item =>
          [
            item.subject,
            item.school.name,
            item.user.email,
            item.user.firstName,
            item.user.lastName,
            item.messages[0]?.content || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(search)
        )

    return reply.send({
      feedback: filteredFeedback,
      threads: filteredThreads,
      summary: {
        feedback: {
          total: filteredFeedback.length,
          new: filteredFeedback.filter(item => item.status === 'NEW').length,
          reviewed: filteredFeedback.filter(item => item.status === 'REVIEWED').length,
          closed: filteredFeedback.filter(item => item.status === 'CLOSED').length,
        },
        threads: {
          total: filteredThreads.length,
          open: filteredThreads.filter(item => item.status === 'OPEN').length,
          inProgress: filteredThreads.filter(item => item.status === 'IN_PROGRESS').length,
          resolved: filteredThreads.filter(item => item.status === 'RESOLVED').length,
        },
      },
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load support inbox' })
  }
}

export const updateAdminFeedbackStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }
    const body = request.body as { status?: 'NEW' | 'REVIEWED' | 'CLOSED' }

    if (!body.status || !['NEW', 'REVIEWED', 'CLOSED'].includes(body.status)) {
      return reply.status(400).send({ error: 'Invalid feedback status' })
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true, updatedAt: true },
    })

    emitAdminSupportUpdated('feedback:status-updated-by-admin')

    return reply.send({ message: 'Feedback status updated', feedback: updated })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to update feedback status' })
  }
}

export const updateAdminSupportThreadStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }
    const body = request.body as { status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' }

    if (!body.status || !['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(body.status)) {
      return reply.status(400).send({ error: 'Invalid support thread status' })
    }

    const updated = await prisma.supportThread.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true, updatedAt: true },
    })

    emitAdminSupportUpdated('support-thread:status-updated-by-admin')

    return reply.send({ message: 'Support thread status updated', thread: updated })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to update support thread status' })
  }
}

export const getAdminActivityHealth = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const now = new Date()
    const nearExpiryCutoff = new Date(now)
    nearExpiryCutoff.setDate(nearExpiryCutoff.getDate() + NEAR_EXPIRY_DAYS)

    const [schools, recentFeedback, recentSupportThreads, recentPayments] = await Promise.all([
      getSchoolSnapshots(),
      prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          category: true,
          status: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      prisma.supportThread.findMany({
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 15,
        select: {
          id: true,
          subject: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
      }),
      prisma.payment.findMany({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          reference: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
        },
      }),
    ])

    const mapped = schools.map(mapSchoolRow)
    const nearingExpiry = mapped.filter(row => {
      const expiryDate = row.subscription.expiryDate ? new Date(row.subscription.expiryDate) : null
      return Boolean(expiryDate && expiryDate > now && expiryDate <= nearExpiryCutoff)
    })

    const expired = mapped.filter(row => row.accessState === 'EXPIRED')

    return reply.send({
      recentRegistrations: mapped.slice(0, 12),
      schoolsNearingExpiry: nearingExpiry,
      schoolsExpired: expired,
      recentFeedback,
      recentSupportThreads,
      recentPayments,
      volume: {
        feedbackLast15: recentFeedback.length,
        supportThreadsLast15: recentSupportThreads.length,
      },
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load platform activity health' })
  }
}

export const getAdminAnalytics = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const now = new Date()
    const ninetyDaysAgo = new Date(now)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [recentUsers, recentPayments, recentSchools, roleGroups] = await Promise.all([
      prisma.user.findMany({
        where: {
          deletedAt: null,
          role: { not: 'SUPERADMIN' },
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          status: 'SUCCESS',
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true, amount: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.school.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: ninetyDaysAgo },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: {
          deletedAt: null,
          role: { in: ['DIRECTOR', 'TEACHER', 'STUDENT'] },
        },
        _count: { _all: true },
      }),
    ])

    return reply.send({
      users: recentUsers,
      payments: recentPayments,
      schools: recentSchools,
      roleDistribution: roleGroups.map(item => ({
        role: item.role,
        count: item._count._all,
      })),
      window: {
        from: ninetyDaysAgo.toISOString(),
        to: now.toISOString(),
        days: 90,
      },
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load analytics data' })
  }
}

export const listAdminUsers = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const query = request.query as {
      q?: string
      role?: string
      schoolId?: string
      activeOnly?: string
      limit?: string
    }
    const limit = Math.min(300, Math.max(20, Number(query.limit || 100)))
    const roleFilter = (query.role || '').trim().toUpperCase()
    const activeOnly = String(query.activeOnly || '').toLowerCase() === 'true'
    const search = (query.q || '').trim().toLowerCase()
    const activeUserCutoff = new Date()
    activeUserCutoff.setDate(activeUserCutoff.getDate() - ACTIVE_USER_WINDOW_DAYS)

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: roleFilter
          ? (roleFilter as any)
          : { in: ['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT'] },
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
        ...(activeOnly ? { lastLoginAt: { gte: activeUserCutoff } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        schoolId: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        school: { select: { id: true, name: true } },
      },
    })

    const filtered = !search
      ? users
      : users.filter(user =>
          [user.firstName, user.lastName, user.email, user.role, user.school?.name || '']
            .join(' ')
            .toLowerCase()
            .includes(search)
        )

    const [totalUsers, activeUsers, usersByRole] = await Promise.all([
      prisma.user.count({
        where: {
          deletedAt: null,
          role: { in: ['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT'] },
        },
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
          role: { in: ['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT'] },
          lastLoginAt: { gte: activeUserCutoff },
        },
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: {
          deletedAt: null,
          role: { in: ['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT'] },
        },
        _count: { _all: true },
      }),
    ])

    const usersBySchool = filtered.reduce<Record<string, { schoolId: string; schoolName: string; count: number }>>(
      (acc, user) => {
        const key = user.schoolId
        if (!acc[key]) {
          acc[key] = {
            schoolId: user.schoolId,
            schoolName: user.school?.name || 'Unknown school',
            count: 0,
          }
        }
        acc[key].count += 1
        return acc
      },
      {}
    )

    return reply.send({
      summary: {
        totalUsers,
        activeUsers,
        byRole: usersByRole.reduce<Record<string, number>>((acc, item) => {
          acc[item.role] = item._count._all
          return acc
        }, {}),
      },
      recentlyRegistered: filtered.slice(0, 20),
      usersBySchool: Object.values(usersBySchool).sort((a, b) => b.count - a.count),
      items: filtered,
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load platform users' })
  }
}

export const listAdminDeletedUsers = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const query = request.query as {
      q?: string
      role?: string
      schoolId?: string
      limit?: string
    }

    const limit = Math.min(300, Math.max(20, Number(query.limit || 100)))
    const roleFilter = (query.role || '').trim().toUpperCase()
    const search = (query.q || '').trim().toLowerCase()

    const deletedUsers = await prisma.user.findMany({
      where: {
        deletedAt: { not: null },
        role: roleFilter
          ? (roleFilter as any)
          : { in: ['DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT'] },
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
      },
      orderBy: [{ deletedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        schoolId: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        deletedBy: true,
        school: { select: { id: true, name: true } },
      },
    })

    const filtered = !search
      ? deletedUsers
      : deletedUsers.filter(user =>
          [user.firstName, user.lastName, user.email, user.role, user.school?.name || '', user.deletedBy || '']
            .join(' ')
            .toLowerCase()
            .includes(search)
        )

    return reply.send({
      total: filtered.length,
      items: filtered,
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to load deleted users' })
  }
}

export const restoreAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true }
    })

    if (!target) {
      return reply.status(404).send({ error: 'User not found' })
    }

    if (!target.deletedAt) {
      return reply.send({ message: 'User is already active' })
    }

    if (target.role === 'SUPERADMIN') {
      return reply.status(400).send({ error: 'Superadmin restore is not managed from this route.' })
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
      }
    })

    emitAdminUsersUpdated('user:restored')
    return reply.send({ message: 'User restored successfully' })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to restore user' })
  }
}

export const softDeleteAdminUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const { id } = request.params as { id: string }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true }
    })

    if (!target) {
      return reply.status(404).send({ error: 'User not found' })
    }

    if (target.role === 'SUPERADMIN') {
      return reply.status(400).send({ error: 'Superadmin accounts cannot be deleted from this route.' })
    }

    if (target.deletedAt) {
      return reply.send({ message: 'User already deleted' })
    }

    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: 'admin',
      }
    })

    emitAdminUsersUpdated('user:deleted-by-admin')
    return reply.send({ message: 'User deleted successfully' })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to delete user' })
  }
}

export const streamAdminEvents = async (request: FastifyRequest, reply: FastifyReply) => {
  const query = request.query as { token?: string }
  const token = String(query.token || '').trim()
  if (!token) {
    return reply.status(401).send({ error: 'Missing stream token' })
  }

  const session = consumeAdminStreamToken(token)
  if (!session) {
    return reply.status(401).send({ error: 'Invalid or expired stream token' })
  }
  if (session.role !== 'SUPERADMIN') {
    return reply.status(403).send({ error: 'Forbidden: Platform admin access only' })
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const send = (event: { type: string; timestamp: string; payload?: Record<string, unknown> }) => {
    if (reply.raw.writableEnded) return
    reply.raw.write(`event: ${event.type}\n`)
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  send({
    type: 'admin:overview-updated',
    timestamp: new Date().toISOString(),
    payload: { bootstrap: true },
  })

  const unsubscribe = subscribeAdminEvents(send)
  const heartbeat = setInterval(() => {
    if (!reply.raw.writableEnded) {
      reply.raw.write(': keep-alive\n\n')
    }
  }, 25000)

  request.raw.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    if (!reply.raw.writableEnded) {
      reply.raw.end()
    }
  })

  request.raw.on('aborted', () => {
    clearInterval(heartbeat)
    unsubscribe()
    if (!reply.raw.writableEnded) {
      reply.raw.end()
    }
  })

  return reply
}

export const createAdminStreamToken = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  const token = issueAdminStreamToken({
    userId: admin.id,
    role: 'SUPERADMIN',
  })

  return reply.send(token)
}

export const emitAdminSupportUpdated = (reason = 'support:changed') => {
  emitAdminEvent('admin:support-updated', {}, { scope: 'support', reason })
  emitAdminEvent('admin:overview-updated', {}, { scope: 'overview', reason })
  emitAdminEvent('admin:activity-updated', {}, { scope: 'activity', reason })
}

export const emitAdminSchoolsUpdated = (reason = 'schools:changed') => {
  emitAdminEvent('admin:schools-updated', {}, { scope: 'schools', reason })
  emitAdminEvent('admin:overview-updated', {}, { scope: 'overview', reason })
  emitAdminEvent('admin:activity-updated', {}, { scope: 'activity', reason })
}

export const emitAdminSubscriptionsUpdated = (reason = 'subscriptions:changed') => {
  emitAdminEvent('admin:subscriptions-updated', {}, { scope: 'subscriptions', reason })
  emitAdminEvent('admin:schools-updated', {}, { scope: 'schools', reason })
  emitAdminEvent('admin:overview-updated', {}, { scope: 'overview', reason })
  emitAdminEvent('admin:activity-updated', {}, { scope: 'activity', reason })
}

export const emitAdminUsersUpdated = (reason = 'users:changed') => {
  emitAdminEvent('admin:users-updated', {}, { scope: 'users', reason })
  emitAdminEvent('admin:overview-updated', {}, { scope: 'overview', reason })
}

export const cleanupStaleSubscriptions = async (request: FastifyRequest, reply: FastifyReply) => {
  const admin = await getAdminContext(request, reply)
  if (!admin) return

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const staleSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: twentyFourHoursAgo },
      },
      select: { id: true, paymentReference: true }
    })
    
    const subscriptionIds = staleSubscriptions.map(s => s.id)
    const paymentReferences = staleSubscriptions
      .map(s => s.paymentReference)
      .filter((ref): ref is string => Boolean(ref))

    await prisma.subscription.deleteMany({
      where: { id: { in: subscriptionIds } }
    })
    
    if (paymentReferences.length > 0) {
      await prisma.payment.deleteMany({
        where: {
          reference: { in: paymentReferences },
          status: 'PENDING'
        }
      })
    }
    
    emitAdminSubscriptionsUpdated('admin:stale-subscriptions-purged')

    return reply.send({ 
      message: 'Stale subscriptions purged', 
      purgedCount: subscriptionIds.length 
    })
  } catch (error) {
    request.server.log.error(error)
    return reply.status(500).send({ error: 'Failed to purge stale subscriptions' })
  }
}
