import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import { Prisma } from '@prisma/client'

const teacherSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  designation: z.string().optional(),
  specialization: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEACTIVATED']).optional(),
})

function formatZodErrors(error: z.ZodError) {
  return error.issues.map((e: any) => ({
    field: e.path.join('.') || 'unknown',
    message: e.message,
  }))
}

function handleUniqueConstraintError(error: any, reply: FastifyReply) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : String(error.meta?.target || '')

    if (target.includes('email')) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email already exists in this school' }],
      })
    }
  }

  return null
}

/**
 * GET /api/teachers
 */
export const getTeachers = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const teachers = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'TEACHER',
        deletedAt: null
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        createdById: true,
        createdByRole: true,
        createdAt: true,
        staffProfile: true,
      } as any,
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(teachers)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch teachers' })
  }
}

/**
 * POST /api/teachers
 */
export const createTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: creatorId, role: creatorRole, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can create teachers
    if (creatorRole !== 'DIRECTOR' && creatorRole !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage staff.' })
    }
    
    const parsed = teacherSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const { firstName, lastName, email, password, designation, specialization } = parsed.data

    if (!password) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password is required for new teacher' }],
      })
    }

    const existingUser = await prisma.user.findFirst({ where: { email, schoolId, deletedAt: null } })
    if (existingUser) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email already exists in this school' }],
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const teacher = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'TEACHER',
        schoolId,
        status: 'ACTIVE',
        createdById: creatorId,
        createdByRole: creatorRole,
        staffProfile: {
          create: {
            schoolId,
            designation,
            specialization,
            joiningDate: new Date(),
          }
        }
      } as any
    })

    return reply.status(201).send({
      success: true,
      message: 'Teacher created successfully',
      id: teacher.id
    })
  } catch (error: any) {
    console.error('Create teacher error:', error)
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: error.message || 'Internal server error' })
  }
}

/**
 * PUT /api/teachers/:id
 */
export const updateTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can update teachers
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage staff.' })
    }
    
    const parsed = teacherSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const data = parsed.data

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'TEACHER', deletedAt: null }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Teacher not found' })
    }

    const duplicateEmail = await prisma.user.findFirst({
      where: {
        schoolId,
        email: data.email,
        deletedAt: null,
        id: { not: id }
      }
    })

    if (duplicateEmail) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email already exists in this school' }],
      })
    }

    const updateData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      status: data.status,
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    await prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        staffProfile: {
          update: {
            designation: data.designation,
            specialization: data.specialization
          }
        }
      }
    })

    return reply.send({ success: true, message: 'Teacher updated successfully' })
  } catch (error: any) {
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: 'Failed to update teacher' })
  }
}

/**
 * DELETE /api/teachers/:id
 */
export const deleteTeacher = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()

    // RBAC: Only Directors and Principals can delete teachers
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage staff.' })
    }

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'TEACHER', deletedAt: null }
    })

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Teacher not found', errorCode: 'NOT_FOUND' })
    }

    // Soft delete the User record
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: 'admin'
      }
    })

    return reply.send({ success: true, message: 'Teacher deleted successfully' })
  } catch (error: any) {
    console.error('Delete teacher error:', error)
    
    if (error.code) {
      return reply.status(500).send({ 
        success: false, 
        error: 'Database constraint violation during deletion.', 
        errorCode: error.code,
        message: error.meta?.cause || 'A related record is preventing this deletion.'
      })
    }
    
    return reply.status(500).send({ success: false, error: 'Failed to delete teacher permanently', errorCode: 'INTERNAL_SERVER_ERROR' })
  }
}
