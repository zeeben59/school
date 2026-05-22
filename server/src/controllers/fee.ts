import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'

const feeSchema = z.object({
  studentId: z.string(),
  amount: z.number().positive(),
  type: z.string(), // e.g., 'Tuition', 'Sports', 'Lab'
  dueDate: z.string(),
  status: z.enum(['PAID', 'UNPAID', 'PARTIAL']).optional(),
  balance: z.number().optional(),
})

/**
 * GET /api/fees
 */
export const getFees = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const fees = await prisma.fee.findMany({
      where: { 
        schoolId,
        deletedAt: null
      },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(fees)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch fees' })
  }
}

/**
 * POST /api/fees
 * Create a new fee bill for a student
 */
export const createFee = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()
    const { studentId, amount, type, dueDate, status, balance } = feeSchema.parse(request.body)

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId, deletedAt: null },
      select: { id: true }
    })

    if (!student) {
      return reply.status(400).send({ error: 'Student not found in this school' })
    }

    const fee = await prisma.fee.create({
      data: {
        amount,
        type,
        dueDate: new Date(dueDate),
        status: status || 'UNPAID',
        balance: balance ?? amount,
        studentId,
        schoolId
      }
    })

    return reply.status(201).send({
      message: 'Fee bill created successfully',
      id: fee.id
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message || 'Validation failed' })
    }
    return reply.status(500).send({ error: 'Failed to create fee bill' })
  }
}

/**
 * PATCH /api/fees/:id
 * Update status or balance
 */
export const updateFee = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()
    const data = request.body as any

    const existing = await prisma.fee.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Fee record not found' })
    }

    const updated = await prisma.fee.update({
      where: { id },
      data: {
        status: data.status,
        balance: data.balance,
        paymentDate: data.status === 'PAID' ? new Date() : existing.paymentDate
      }
    })

    return reply.send({ message: 'Fee updated', fee: updated })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed' })
  }
}

/**
 * DELETE /api/fees/:id
 */
export const deleteFee = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const existing = await prisma.fee.findFirst({
      where: { id, schoolId }
    })

    if (!existing) return reply.status(404).send({ error: 'Not found' })

    // Soft delete the Fee record
    await prisma.fee.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
    return reply.send({ message: 'Fee record deleted successfully' })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed' })
  }
}
