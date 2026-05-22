import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import { Prisma } from '@prisma/client'

const principalSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
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
 * GET /api/principals
 */
export const getPrincipals = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { role, schoolId } = await request.jwtVerify<{ role: string, schoolId: string }>()

    // RBAC: Only Directors can list other Principals (or we can allow Principals to see peers)
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized.' })
    }

    const principals = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'PRINCIPAL',
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
      } as any,
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(principals)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch principals' })
  }
}

/**
 * POST /api/principals
 */
export const createPrincipal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: creatorId, role: creatorRole, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    
    // RBAC: Only Directors can create Principals
    if (creatorRole !== 'DIRECTOR') {
      return reply.status(403).send({ error: 'Unauthorized. Only the Director can manage Principals.' })
    }
    
    const parsed = principalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const { firstName, lastName, email, password } = parsed.data

    if (!password) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'password', message: 'Password is required for new principal' }],
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

    const principal = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: 'PRINCIPAL',
        schoolId,
        status: 'ACTIVE',
        createdById: creatorId,
        createdByRole: creatorRole,
      } as any
    })

    return reply.status(201).send({
      success: true,
      message: 'Principal created successfully',
      id: principal.id
    })
  } catch (error: any) {
    console.error('Create principal error:', error)
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: error.message || 'Internal server error' })
  }
}

/**
 * PUT /api/principals/:id
 */
export const updatePrincipal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string, schoolId: string }>()
    
    // RBAC: Only Directors can update Principals
    if (role !== 'DIRECTOR') {
      return reply.status(403).send({ error: 'Unauthorized. Only the Director can manage Principals.' })
    }
    
    const parsed = principalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const data = parsed.data

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'PRINCIPAL', deletedAt: null }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Principal not found' })
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
      data: updateData
    })

    return reply.send({ success: true, message: 'Principal updated successfully' })
  } catch (error: any) {
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: 'Failed to update principal' })
  }
}

/**
 * DELETE /api/principals/:id
 */
export const deletePrincipal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string, schoolId: string }>()

    // RBAC: Only Directors can delete Principals
    if (role !== 'DIRECTOR') {
      return reply.status(403).send({ error: 'Unauthorized. Only the Director can delete Principals.' })
    }

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'PRINCIPAL', deletedAt: null }
    })

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Principal not found', errorCode: 'NOT_FOUND' })
    }

    // Soft delete the User record
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: 'admin'
      }
    })

    return reply.send({ success: true, message: 'Principal deleted successfully' })
  } catch (error: any) {
    console.error('Delete principal error:', error)
    
    if (error.code) {
      return reply.status(500).send({ 
        success: false, 
        error: 'Database constraint violation during deletion.', 
        errorCode: error.code,
        message: error.meta?.cause || 'A related record is preventing this deletion.'
      })
    }
    
    return reply.status(500).send({ success: false, error: 'Failed to delete principal permanently', errorCode: 'INTERNAL_SERVER_ERROR' })
  }
}
