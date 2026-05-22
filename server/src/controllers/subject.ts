import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'

const subjectSchema = z.object({
  name: z.string().min(1, 'Subject title is required'),
  code: z.string().optional().transform(v => v === '' ? null : v),
  level: z.string().optional().transform(v => v === '' ? null : v),
  teacherId: z.string().optional().transform(v => v === '' ? null : v),
  classId: z.string().optional().transform(v => v === '' ? null : v),
})

/**
 * GET /api/subjects
 */
export const getSubjects = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const subjects = await prisma.subject.findMany({
      where: { 
        schoolId,
        deletedAt: null
      },
      include: {
        teacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        class: true
      },
      orderBy: { name: 'asc' }
    })

    return reply.send(subjects)
  } catch (error: any) {
    console.error('Fetch subjects error:', error)
    return reply.status(500).send({ error: 'Failed to fetch subjects' })
  }
}

/**
 * POST /api/subjects
 */
export const createSubject = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, role, id: userId } = await request.jwtVerify<{ schoolId: string; role: string; id: string }>()
    
    // RBAC: Only Directors and Principals can create subjects
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage subjects.' })
    }
    
    // Validate input
    const parseResult = subjectSchema.safeParse(request.body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message)
      return reply.status(400).send({ error: errors[0], errors })
    }
    
    const { name, code, level, teacherId, classId } = parseResult.data

    // Validate teacherId exists in this school if provided
    if (teacherId) {
      const teacher = await prisma.staff.findFirst({
        where: { id: teacherId, schoolId }
      })
      if (!teacher) {
        return reply.status(400).send({ error: 'Assigned teacher not found in this school' })
      }
    }

    // Validate classId exists in this school if provided
    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, schoolId }
      })
      if (!cls) {
        return reply.status(400).send({ error: 'Selected class not found in this school' })
      }
    }

    // Check for duplicate subject code within same school
    if (code) {
      const existing = await prisma.subject.findFirst({
        where: { code, schoolId }
      })
      if (existing) {
        return reply.status(409).send({ error: `Subject code "${code}" already exists in this school` })
      }
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        level,
        teacherId,
        classId,
        schoolId,
        createdById: userId,
        createdByRole: role,
      }
    })

    return reply.status(201).send({
      success: true,
      message: 'Subject created successfully',
      id: subject.id
    })
  } catch (error: any) {
    console.error('Create subject error:', error)
    
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'A subject with this information already exists' })
    }
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid reference: a linked record (teacher or class) does not exist' })
    }
    
    return reply.status(500).send({ error: 'Internal server error while creating subject' })
  }
}

/**
 * PUT /api/subjects/:id
 */
export const updateSubject = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can update subjects
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage subjects.' })
    }
    
    const parseResult = subjectSchema.safeParse(request.body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((e: any) => e.message)
      return reply.status(400).send({ error: errors[0], errors })
    }
    
    const { name, code, level, teacherId, classId } = parseResult.data

    const existing = await prisma.subject.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Subject not found' })
    }

    // Validate teacherId if provided
    if (teacherId) {
      const teacher = await prisma.staff.findFirst({
        where: { id: teacherId, schoolId }
      })
      if (!teacher) {
        return reply.status(400).send({ error: 'Assigned teacher not found in this school' })
      }
    }

    // Validate classId if provided
    if (classId) {
      const cls = await prisma.class.findFirst({
        where: { id: classId, schoolId }
      })
      if (!cls) {
        return reply.status(400).send({ error: 'Selected class not found in this school' })
      }
    }

    // Check duplicate code (excluding current subject)
    if (code) {
      const duplicate = await prisma.subject.findFirst({
        where: { code, schoolId, NOT: { id } }
      })
      if (duplicate) {
        return reply.status(409).send({ error: `Subject code "${code}" already exists in this school` })
      }
    }

    await prisma.subject.update({
      where: { id },
      data: {
        name,
        code,
        level,
        teacherId,
        classId,
      }
    })

    return reply.send({ success: true, message: 'Subject updated successfully' })
  } catch (error: any) {
    console.error('Update subject error:', error)
    
    if (error.code === 'P2003') {
      return reply.status(400).send({ error: 'Invalid reference: a linked record (teacher or class) does not exist' })
    }
    
    return reply.status(500).send({ error: 'Internal server error while updating subject' })
  }
}

/**
 * DELETE /api/subjects/:id
 */
export const deleteSubject = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()

    // RBAC: Only Directors and Principals can delete subjects
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage subjects.' })
    }

    const existing = await prisma.subject.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Subject not found', errorCode: 'NOT_FOUND' })
    }

    // Soft delete the Subject record
    await prisma.subject.update({
      where: { id },
      data: { deletedAt: new Date() }
    })

    return reply.send({ success: true, message: 'Subject deleted successfully' })
  } catch (error: any) {
    console.error('Delete subject error:', error)
    
    if (error.code) {
      return reply.status(500).send({ 
        success: false, 
        error: 'Database constraint violation during deletion.', 
        errorCode: error.code,
        message: error.meta?.cause || 'A related record is preventing this deletion.'
      })
    }
    
    return reply.status(500).send({ success: false, error: 'Failed to delete subject', errorCode: 'INTERNAL_SERVER_ERROR' })
  }
}
