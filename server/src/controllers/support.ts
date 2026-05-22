import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'
import { sendSupportNotificationEmail } from '../utils/mail.js'
import { generatePlatformHelpReply, generateSupportAssistantReply } from '../utils/support-ai.js'
import { emitAdminSupportUpdated } from './admin.js'

const feedbackSchema = z.object({
  category: z.string().trim().min(2, 'Category is required'),
  message: z.string().trim().min(5, 'Message is required'),
  rating: z.number().int().min(1).max(5).optional(),
})

const createThreadSchema = z.object({
  subject: z.string().trim().min(3, 'Subject is required'),
  message: z.string().trim().min(3, 'Message is required'),
})

const postMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message content is required'),
})

const aiHelpSchema = z.object({
  question: z.string().trim().min(2, 'Question is required'),
  currentPage: z.string().trim().max(120).optional(),
})

const feedbackStatusSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'CLOSED']),
})

async function getAuthContext(request: FastifyRequest) {
  const existingUser = (request as any).user as { id?: string; schoolId?: string; role?: string } | undefined
  if (existingUser?.id && existingUser?.schoolId && existingUser?.role) {
    return {
      userId: existingUser.id,
      schoolId: existingUser.schoolId,
      role: existingUser.role,
    }
  }

  const decoded = await request.jwtVerify<{ id: string; schoolId: string; role: string }>()
  return {
    userId: decoded.id,
    schoolId: decoded.schoolId,
    role: decoded.role,
  }
}

function canViewSchoolWideSupport(role: string) {
  return role === 'DIRECTOR' || role === 'PRINCIPAL'
}

async function loadActorDetails(params: { userId: string; schoolId: string }) {
  const [user, school] = await Promise.all([
    prisma.user.findFirst({
      where: { id: params.userId, schoolId: params.schoolId },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),
    prisma.school.findUnique({
      where: { id: params.schoolId },
      select: { id: true, name: true },
    }),
  ])

  return {
    userEmail: user?.email || null,
    userName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
    schoolName: school?.name || null,
  }
}

async function findThreadWithScopeCheck(params: {
  threadId: string
  schoolId: string
  userId: string
  role: string
}) {
  const thread = await prisma.supportThread.findFirst({
    where: { id: params.threadId, schoolId: params.schoolId },
    select: { id: true, schoolId: true, userId: true, role: true, subject: true, status: true }
  })

  if (!thread) {
    return { status: 404 as const, error: 'Support thread not found' }
  }

  if (!canViewSchoolWideSupport(params.role) && thread.userId !== params.userId) {
    return { status: 403 as const, error: 'You are not allowed to access this support thread' }
  }

  return { thread }
}

export const submitFeedback = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const parsed = feedbackSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Validation failed' })
    }

    const feedback = await prisma.feedback.create({
      data: {
        schoolId,
        userId,
        role,
        category: parsed.data.category,
        message: parsed.data.message,
        rating: parsed.data.rating ?? null,
        status: 'NEW',
      }
    })

    try {
      const actor = await loadActorDetails({ userId, schoolId })
      await sendSupportNotificationEmail({
        type: 'FEEDBACK',
        schoolId,
        schoolName: actor.schoolName,
        userId,
        userEmail: actor.userEmail,
        userName: actor.userName,
        role,
        category: parsed.data.category,
        message: parsed.data.message,
        createdAt: feedback.createdAt,
      })
    } catch (mailError) {
      request.log.error({ err: mailError, schoolId, userId }, 'Failed to send feedback notification email')
    }

    emitAdminSupportUpdated('feedback:created')

    return reply.status(201).send({
      message: 'Feedback submitted successfully',
      feedback: {
        id: feedback.id,
        category: feedback.category,
        status: feedback.status,
        createdAt: feedback.createdAt,
      }
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to submit feedback' })
  }
}

export const updateFeedbackStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, role } = await getAuthContext(request)
    if (!canViewSchoolWideSupport(role)) {
      return reply.status(403).send({ error: 'You are not allowed to update feedback status' })
    }

    const { id } = request.params as { id: string }
    const parsed = feedbackStatusSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Validation failed' })
    }

    const feedback = await prisma.feedback.findFirst({
      where: { id, schoolId },
      select: { id: true },
    })

    if (!feedback) {
      return reply.status(404).send({ error: 'Feedback not found' })
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    emitAdminSupportUpdated('feedback:status-updated')

    return reply.send({
      message: 'Feedback status updated',
      feedback: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt },
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to update feedback status' })
  }
}

export const listFeedback = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const items = await prisma.feedback.findMany({
      where: canViewSchoolWideSupport(role) ? { schoolId } : { schoolId, userId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.send(items)
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to fetch feedback' })
  }
}

export const createSupportThread = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const parsed = createThreadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Validation failed' })
    }

    const { subject, message } = parsed.data
    const thread = await prisma.$transaction(async (tx) => {
      const createdThread = await tx.supportThread.create({
        data: {
          schoolId,
          userId,
          role,
          subject,
          status: 'OPEN',
          lastMessageAt: new Date(),
        }
      })

      await tx.supportMessage.create({
        data: {
          threadId: createdThread.id,
          schoolId,
          senderUserId: userId,
          senderRole: role,
          senderType: 'USER',
          content: message,
        }
      })

      return createdThread
    })

    try {
      const actor = await loadActorDetails({ userId, schoolId })
      await sendSupportNotificationEmail({
        type: 'SUPPORT_THREAD',
        schoolId,
        schoolName: actor.schoolName,
        userId,
        userEmail: actor.userEmail,
        userName: actor.userName,
        role,
        subject,
        message,
        createdAt: thread.createdAt,
      })
    } catch (mailError) {
      request.log.error({ err: mailError, schoolId, userId }, 'Failed to send support thread notification email')
    }

    emitAdminSupportUpdated('support-thread:created')

    return reply.status(201).send({
      message: 'Support thread created successfully',
      thread
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to create support thread' })
  }
}

export const listSupportThreads = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)

    const threads = await prisma.supportThread.findMany({
      where: canViewSchoolWideSupport(role) ? { schoolId } : { schoolId, userId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderType: true, createdAt: true }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    })

    return reply.send(threads)
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to fetch support threads' })
  }
}

export const getSupportThreadMessages = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const { id: threadId } = request.params as { id: string }

    const scopedThread = await findThreadWithScopeCheck({ threadId, schoolId, userId, role })
    if ('error' in scopedThread) {
      return reply.status(scopedThread.status ?? 403).send({ error: scopedThread.error })
    }

    const messages = await prisma.supportMessage.findMany({
      where: { threadId, schoolId },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ thread: scopedThread.thread, messages })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to fetch support messages' })
  }
}

export const postSupportMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const { id: threadId } = request.params as { id: string }
    const parsed = postMessageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Validation failed' })
    }

    const scopedThread = await findThreadWithScopeCheck({ threadId, schoolId, userId, role })
    if ('error' in scopedThread) {
      return reply.status(scopedThread.status ?? 403).send({ error: scopedThread.error })
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: {
          threadId,
          schoolId,
          senderUserId: userId,
          senderRole: role,
          senderType: 'USER',
          content: parsed.data.content,
        }
      })

      await tx.supportThread.update({
        where: { id: threadId },
        data: { lastMessageAt: created.createdAt }
      })

      return created
    })

    try {
      const actor = await loadActorDetails({ userId, schoolId })
      await sendSupportNotificationEmail({
        type: 'SUPPORT_MESSAGE',
        schoolId,
        schoolName: actor.schoolName,
        userId,
        userEmail: actor.userEmail,
        userName: actor.userName,
        role,
        subject: scopedThread.thread.subject,
        message: parsed.data.content,
        createdAt: message.createdAt,
      })
    } catch (mailError) {
      request.log.error({ err: mailError, schoolId, userId }, 'Failed to send support message notification email')
    }

    emitAdminSupportUpdated('support-message:created')
    return reply.status(201).send({ message: 'Support message sent', data: message })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to send support message' })
  }
}

export const createAssistantReply = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId, role } = await getAuthContext(request)
    const { id: threadId } = request.params as { id: string }

    const scopedThread = await findThreadWithScopeCheck({ threadId, schoolId, userId, role })
    if ('error' in scopedThread) {
      return reply.status(scopedThread.status ?? 403).send({ error: scopedThread.error })
    }

    const latestUserMessage = await prisma.supportMessage.findFirst({
      where: { threadId, schoolId, senderType: 'USER' },
      orderBy: { createdAt: 'desc' },
      select: { content: true }
    })

    if (!latestUserMessage) {
      return reply.status(400).send({ error: 'No user message found to assist with' })
    }

    const assistantContent = generateSupportAssistantReply({
      subject: scopedThread.thread.subject,
      latestUserMessage: latestUserMessage.content,
      role: scopedThread.thread.role,
    })

    const assistantMessage = await prisma.$transaction(async (tx) => {
      const created = await tx.supportMessage.create({
        data: {
          threadId,
          schoolId,
          senderType: 'ASSISTANT',
          senderRole: 'ASSISTANT',
          content: assistantContent,
          senderUserId: null
        }
      })

      await tx.supportThread.update({
        where: { id: threadId },
        data: { lastMessageAt: created.createdAt }
      })

      return created
    })

    emitAdminSupportUpdated('support-assistant:replied')

    return reply.status(201).send({
      message: 'Assistant reply generated',
      data: assistantMessage
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to generate assistant response' })
  }
}

export const aiHelp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { role } = await getAuthContext(request)
    const parsed = aiHelpSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message || 'Validation failed' })
    }

    const result = generatePlatformHelpReply({
      role,
      question: parsed.data.question,
      currentPage: parsed.data.currentPage,
    })

    return reply.send({
      answer: result.answer,
      inScope: result.inScope,
      quickActions: result.quickActions || [],
      supportMessage: result.supportMessage || null,
      supportPath: '/dashboard/support',
    })
  } catch (error) {
    return reply.status(500).send({ error: 'Failed to generate platform help' })
  }
}
