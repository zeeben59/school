import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'

const noticeSchema = z.object({
  title: z.string().min(3, 'Title is required (min 3 characters)'),
  content: z.string().min(5, 'Message content is required (min 5 characters)'),
  target: z.enum(['ALL', 'PRINCIPAL', 'TEACHER', 'STUDENT']),
})

/**
 * GET /api/notices
 * List all notices for the school
 */
export const getNotices = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, role } = await request.jwtVerify<{ schoolId: string, role: string }>()

    const where: any = { schoolId, deletedAt: null }
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      where.targetRole = { in: ['ALL', role] }
    }

    const notices = await prisma.notice.findMany({
      where,
      include: {
        author: {
          select: { firstName: true, lastName: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Map `targetRole` back to `target` for the frontend's expected interface
    const mappedNotices = notices.map(notice => ({
      ...notice,
      target: notice.targetRole || 'ALL'
    }))

    return reply.send(mappedNotices)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch notices' })
  }
}

/**
 * POST /api/notices
 * Create a new notice
 */
export const createNotice = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, role, id: authorId } = await request.jwtVerify<{ schoolId: string, role: string, id: string }>()
    
    // RBAC: Only Directors and Principals can create notices
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can publish notices.' })
    }
    
    // Zod validation with safeParse to catch specific errors
    const parseResult = noticeSchema.safeParse(request.body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: z.ZodIssue) => e.message)
      return reply.status(400).send({ error: errors[0], errors })
    }
    
    const { title, content, target } = parseResult.data

    const notice = await prisma.notice.create({
      data: {
        title,
        content,
        targetRole: target, // Fix: schema expects 'targetRole', not 'target'
        authorId,
        schoolId
      }
    })

    // Fetch target recipients
    const whereClause: any = { schoolId, status: 'ACTIVE' }
    if (target !== 'ALL') {
      whereClause.role = target
    }
    
    // Do not notify the author in the feed
    whereClause.id = { not: authorId }
    
    const targetUsers = await prisma.user.findMany({
      where: whereClause,
      select: { id: true }
    })

    const authorUser = await prisma.user.findUnique({
      where: { id: authorId },
      select: { role: true }
    })

    if (targetUsers.length > 0) {
      await prisma.notification.createMany({
        data: targetUsers.map(u => ({
          userId: u.id,
          schoolId,
          type: 'ANNOUNCEMENT',
          title: title,
          message: content,
          relatedId: notice.id,
          createdById: authorId,
          createdByRole: authorUser?.role || null
        }))
      })
    }

    return reply.status(201).send({
      message: 'Announcement published successfully',
      id: notice.id
    })
  } catch (error: any) {
    console.error('Notice creation error:', error)
    return reply.status(500).send({ error: 'Failed to publish announcement' })
  }
}

/**
 * DELETE /api/notices/:id
 */
export const deleteNotice = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string, schoolId: string }>()

    // RBAC: Only Directors and Principals can delete notices
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage notices.' })
    }

    const existing = await prisma.notice.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Announcement not found' })
    }

    // Soft delete the Notice record
    await prisma.notice.update({
      where: { id },
      data: { deletedAt: new Date() }
    })

    return reply.send({ message: 'Announcement deleted successfully' })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to delete announcement' })
  }
}
