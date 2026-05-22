import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../db/prisma.js'
import { Role } from '@prisma/client'
import {
  deriveSchoolAccessState,
  ensureSchoolSubscriptionState,
  getPriceForTermNaira,
  DEFAULT_SUBSCRIPTION_TERM
} from '../utils/subscription.js'

/**
 * GET /api/dashboard/summary
 * Returns tenant-specific dashboard stats for the logged-in user's school
 */
export const getDashboardSummary = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const decoded = await request.jwtVerify<{ id: string; schoolId: string; role: string }>()
    const { schoolId } = decoded
    const subscriptionState = await ensureSchoolSubscriptionState(schoolId)

    // Parallel queries for performance — all scoped to tenant
    const [
      totalStudents,
      totalTeachers,
      totalPrincipals,
      totalClasses,
      totalSubjects,
      school,
      recentPayment,
      latestSubscription,
      notices,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, deletedAt: null } }),
      prisma.user.count({ where: { schoolId, role: Role.TEACHER, deletedAt: null } }),
      prisma.user.count({ where: { schoolId, role: Role.PRINCIPAL, deletedAt: null } }),
      prisma.class.count({ where: { schoolId, deletedAt: null } }),
      prisma.subject.count({ where: { schoolId, deletedAt: null } }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, status: true, createdAt: true }
      }),
      prisma.payment.findFirst({
        where: { schoolId, status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        select: { amount: true, createdAt: true, type: true }
      }),
      prisma.subscription.findFirst({
        where: { schoolId },
        orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          termName: true,
          status: true,
          startDate: true,
          endDate: true,
          paymentReference: true,
          amount: true,
        }
      }),
      prisma.notice.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { author: { select: { firstName: true, lastName: true } } }
      }),
    ])

    // Generate dynamic setup checklist based on real entity counts
    const checklist = []
    if (totalPrincipals === 0 && decoded.role === 'DIRECTOR') {
      checklist.push({ id: 'setup-principal', title: 'Assign Principal', message: 'Add a principal to delegate administrative school management.' })
    }
    if (totalClasses === 0) {
      checklist.push({ id: 'setup-classes', title: 'Define Classes', message: 'Create class levels (e.g. Grade 1, SS3) to enable enrollment.' })
    }
    if (totalTeachers === 0) {
      checklist.push({ id: 'setup-teachers', title: 'Onboard Teachers', message: 'Add teacher accounts to begin subject assignments.' })
    }
    if (totalSubjects === 0) {
      checklist.push({ id: 'setup-subjects', title: 'Configure Subjects', message: 'Define the curriculum subjects offered in your school.' })
    }
    if (totalStudents === 0) {
      checklist.push({ id: 'setup-students', title: 'Enroll Students', message: 'Start registering students into their respective classes.' })
    }

    const accessState = deriveSchoolAccessState({
      schoolStatus: school?.status,
      hasActiveSubscription: Boolean(subscriptionState?.activeSubscription),
      hasActiveTrial: Boolean(subscriptionState?.trial?.isActive),
    })

    return reply.send({
      school: {
        name: school?.name || 'Unknown School',
        status: school?.status || 'UNKNOWN',
        createdAt: school?.createdAt,
      },
      stats: {
        totalStudents,
        totalTeachers,
        totalPrincipals,
        totalClasses,
        totalSubjects,
      },
      checklist, // Real-time data-driven checklist
      subscription: {
        status: accessState === 'ACTIVE' ? 'Active' : accessState === 'EXPIRED' ? 'Expired' : 'Inactive',
        accessState,
        hasActiveSubscription: Boolean(subscriptionState?.activeSubscription),
        hasActiveTrial: Boolean(subscriptionState?.trial?.isActive),
        trialEndsAt: subscriptionState?.trial?.endsAt || null,
        activeTerm: subscriptionState?.activeSubscription?.termName || latestSubscription?.termName || null,
        expiryDate: subscriptionState?.activeSubscription?.endDate || latestSubscription?.endDate || null,
        amount: latestSubscription?.amount || getPriceForTermNaira(DEFAULT_SUBSCRIPTION_TERM),
        paymentReference: latestSubscription?.paymentReference || null,
        lastPayment: recentPayment ? {
          amount: recentPayment.amount,
          date: recentPayment.createdAt,
          type: recentPayment.type,
        } : null,
      },
      notices: notices.map((n: any) => ({
        id: n.id,
        title: n.title,
        author: `${n.author.firstName} ${n.author.lastName}`,
        createdAt: n.createdAt
      }))
    })
  } catch (error: any) {
    console.error('Dashboard summary error:', error.message)
    return reply.status(500).send({ error: 'Failed to load dashboard data' })
  }
}
