import { FastifyRequest, FastifyReply } from 'fastify'
import prisma from '../db/prisma.js'

function isAuthError(error: any) {
  const code = String(error?.code || '')
  return code.startsWith('FST_JWT_')
}

async function resolveAuthContext(request: FastifyRequest) {
  const existingUser = (request as any).user as { id?: string; schoolId?: string } | undefined
  if (existingUser?.id && existingUser?.schoolId) {
    return { userId: existingUser.id, schoolId: existingUser.schoolId }
  }

  const decoded = await request.jwtVerify<{ id: string; schoolId: string }>()
  return { userId: decoded.id, schoolId: decoded.schoolId }
}

/**
 * GET /api/notifications
 * Fetch latest 20 notifications for the current user
 */
export const getNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId } = await resolveAuthContext(request)

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        schoolId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return reply.send(notifications)
  } catch (error: any) {
    console.error('Fetch notifications error:', error)
    if (isAuthError(error)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    return reply.status(500).send({ error: 'Failed to fetch notifications' })
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId } = await resolveAuthContext(request)
    const { id } = request.params as { id: string }

    const notification = await prisma.notification.findFirst({
      where: { id, userId, schoolId }
    })

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' })
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    })

    return reply.send({ success: true })
  } catch (error: any) {
    console.error('Mark read error:', error)
    if (isAuthError(error)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    return reply.status(500).send({ error: 'Failed to mark notification as read' })
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for current user
 */
export const markAllAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { userId, schoolId } = await resolveAuthContext(request)

    await prisma.notification.updateMany({
      where: { userId, schoolId, isRead: false },
      data: { isRead: true }
    })

    return reply.send({ success: true })
  } catch (error: any) {
    console.error('Mark all read error:', error)
    if (isAuthError(error)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    return reply.status(500).send({ error: 'Failed to mark all notifications as read' })
  }
}
