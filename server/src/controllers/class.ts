import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'

const classSchema = z.object({
  level: z.string().min(1, 'Class level is required'),
  arm: z.string().min(1, 'Class arm is required'),
  classTeacherId: z.string().min(1, 'Class teacher is required'),
})

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((e: any) => ({
    field: e.path.join('.') || 'unknown',
    message: e.message,
  }))
}

/**
 * Helper to create a notification for class assignment
 */
async function createAssignmentNotification(params: {
  staffId: string,
  className: string,
  creatorId: string,
  creatorRole: string,
  schoolId: string,
  classId: string
}) {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: params.staffId },
      select: { userId: true }
    })

    if (!staff) return

    await (prisma.notification as any).create({
      data: {
        userId: staff.userId,
        schoolId: params.schoolId,
        type: 'CLASS_ASSIGNMENT',
        title: 'New Class Assignment',
        message: `You have been assigned to class ${params.className} by the ${params.creatorRole.toLowerCase()}.`,
        relatedId: params.classId,
        createdById: params.creatorId,
        createdByRole: params.creatorRole,
        isRead: false
      }
    })
  } catch (err) {
    console.error('Failed to create assignment notification:', err)
  }
}

/**
 * GET /api/classes
 */
export const getClasses = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const classes = await prisma.class.findMany({
      where: { 
        schoolId,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        level: true,
        arm: true,
        createdById: true,
        createdByRole: true,
        createdAt: true,
        classTeacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        subjects: true,
        _count: {
          select: { enrollments: true }
        }
      } as any,
      orderBy: { name: 'asc' }
    })

    return reply.send(classes)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch classes' })
  }
}

/**
 * POST /api/classes
 */
export const createClass = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: creatorId, role: creatorRole, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can create classes
    if (creatorRole !== 'DIRECTOR' && creatorRole !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage classes.' })
    }
    
    const parsed = classSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const { level, arm, classTeacherId } = parsed.data
    
    // Logic: JS1 + A = JS1A, Primary 4 + Gold = Primary 4 Gold
    const name = arm.length === 1 ? `${level}${arm}` : `${level} ${arm}`

    const existing = await prisma.class.findFirst({
      where: { schoolId, name }
    })

    if (existing) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'name', message: `Class ${name} already exists in this school` }],
      })
    }

    const newClass = await prisma.class.create({
      data: {
        name,
        level,
        arm,
        classTeacherId,
        schoolId,
        createdById: creatorId,
        createdByRole: creatorRole,
      } as any
    })

    // Trigger Notification
    if (classTeacherId) {
      await createAssignmentNotification({
        staffId: classTeacherId,
        className: name,
        creatorId,
        creatorRole,
        schoolId,
        classId: newClass.id
      })
    }

    return reply.status(201).send({
      success: true,
      message: 'Class created successfully',
      id: newClass.id
    })
  } catch (error: any) {
    console.error('Create class error:', error)
    return reply.status(500).send({ error: 'Failed to create class' })
  }
}

/**
 * PUT /api/classes/:id
 */
export const updateClass = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { id: creatorId, role: creatorRole, schoolId } = await request.jwtVerify<{ id: string, role: string, schoolId: string }>()
    
    // RBAC: Only Directors and Principals can update classes
    if (creatorRole !== 'DIRECTOR' && creatorRole !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage classes.' })
    }
    
    const parsed = classSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const { level, arm, classTeacherId } = parsed.data
    const name = arm.length === 1 ? `${level}${arm}` : `${level} ${arm}`

    const existing = await prisma.class.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Class not found' })
    }

    // Check for duplicates if name changed
    if (existing.name !== name) {
      const duplicate = await prisma.class.findFirst({
        where: { schoolId, name, id: { not: id } }
      })
      if (duplicate) {
        return reply.status(400).send({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'name', message: `Another class named ${name} already exists` }],
        })
      }
    }

    await prisma.class.update({
      where: { id },
      data: {
        name,
        level,
        arm,
        classTeacherId
      }
    })

    // Trigger Notification if teacher changed
    if (classTeacherId && classTeacherId !== existing.classTeacherId) {
      await createAssignmentNotification({
        staffId: classTeacherId,
        className: name,
        creatorId,
        creatorRole,
        schoolId,
        classId: id
      })
    }

    return reply.send({ success: true, message: 'Class updated successfully' })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to update class' })
  }
}

/**
 * DELETE /api/classes/:id
 */
export const deleteClass = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()

    // RBAC: Only Directors and Principals can delete classes
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage classes.' })
    }

    const existing = await prisma.class.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Class not found', errorCode: 'NOT_FOUND' })
    }

    // Soft delete the Class record
    await prisma.class.update({
      where: { id },
      data: { deletedAt: new Date() }
    })

    return reply.send({ success: true, message: 'Class deleted successfully' })
  } catch (error: any) {
    console.error('Delete class error:', error)
    
    if (error.code) {
      return reply.status(500).send({ 
        success: false, 
        error: 'Database constraint violation during deletion.', 
        errorCode: error.code,
        message: error.meta?.cause || 'A related record is preventing this deletion.'
      })
    }
    
    return reply.status(500).send({ success: false, error: 'Failed to delete class', errorCode: 'INTERNAL_SERVER_ERROR' })
  }
}
