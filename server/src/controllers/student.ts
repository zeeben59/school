import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import { Prisma } from '@prisma/client'

const studentSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  admissionNo: z.string().min(1, 'Admission number is required'),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DEACTIVATED']).optional(),
  classId: z.string().optional(),
  academicYear: z.string().optional(),
})

const getDefaultAcademicYear = () => `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`

/**
 * Format Zod errors into a user-friendly array
 */
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

    if (target.includes('schoolId') && target.includes('admissionNo')) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'admissionNo', message: 'Admission number already exists in this school' }],
      })
    }
  }

  return null
}

/**
 * GET /api/students
 */
export const getStudents = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()

    const students = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
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
        studentProfile: {
          include: {
            enrollments: {
              include: {
                class: true
              }
            }
          }
        }
      } as any,
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(students)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch students' })
  }
}

/**
 * POST /api/students
 */
export const createStudent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: creatorId, role: creatorRole, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can create students
    if (creatorRole !== 'DIRECTOR' && creatorRole !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage students.' })
    }
    
    const parsed = studentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const { firstName, lastName, email, password, admissionNo, gender, dateOfBirth, classId, academicYear } = parsed.data

    const existingUser = await prisma.user.findFirst({ where: { email, schoolId, deletedAt: null } })
    if (existingUser) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'email', message: 'Email already exists in this school' }],
      })
    }

    const existingAdmission = await prisma.student.findFirst({ where: { admissionNo, schoolId } })
    if (existingAdmission) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'admissionNo', message: 'Admission number already exists in this school' }],
      })
    }

    if (classId) {
      const targetClass = await prisma.class.findFirst({
        where: { id: classId, schoolId }
      })
      if (!targetClass) {
        return reply.status(400).send({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'classId', message: 'Selected class was not found in this school' }],
        })
      }
    }

    const hashedPassword = await bcrypt.hash(password || 'student123', 10)

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          role: 'STUDENT',
          schoolId,
          status: 'ACTIVE',
          createdById: creatorId,
          createdByRole: creatorRole,
          studentProfile: {
            create: {
              schoolId,
              admissionNo,
              gender,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            }
          }
        } as any,
        include: { studentProfile: true }
      })

      if (classId && student.studentProfile) {
        await tx.enrollment.create({
          data: {
            studentId: student.studentProfile.id,
            classId,
            academicYear: academicYear || getDefaultAcademicYear(),
          }
        })
      }

      return student
    })

    return reply.status(201).send({
      success: true,
      message: 'Student created successfully',
      id: result.id
    })
  } catch (error: any) {
    console.error('Create student error:', error)
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: error.message || 'Internal server error' })
  }
}

/**
 * PUT /api/students/:id
 */
export const updateStudent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()
    
    // RBAC: Only Directors and Principals can update students
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage students.' })
    }
    
    const parsed = studentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: formatZodErrors(parsed.error),
      })
    }

    const data = parsed.data

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'STUDENT', deletedAt: null }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Student not found' })
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

    const duplicateAdmission = await prisma.student.findFirst({
      where: {
        schoolId,
        admissionNo: data.admissionNo,
        userId: { not: id }
      }
    })

    if (duplicateAdmission) {
      return reply.status(400).send({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'admissionNo', message: 'Admission number already exists in this school' }],
      })
    }

    if (data.classId) {
      const targetClass = await prisma.class.findFirst({
        where: { id: data.classId, schoolId }
      })
      if (!targetClass) {
        return reply.status(400).send({
          success: false,
          message: 'Validation failed',
          errors: [{ field: 'classId', message: 'Selected class was not found in this school' }],
        })
      }
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

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...updateData,
          studentProfile: {
            update: {
              admissionNo: data.admissionNo,
              gender: data.gender,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            }
          }
        }
      })

      if (data.classId) {
        const studentProfile = await tx.student.findUnique({
          where: { userId: updated.id },
          select: { id: true }
        })

        if (studentProfile) {
          const targetAcademicYear = data.academicYear || getDefaultAcademicYear()
          const sameYearEnrollment = await tx.enrollment.findFirst({
            where: { studentId: studentProfile.id, academicYear: targetAcademicYear },
            select: { id: true }
          })

          if (sameYearEnrollment) {
            await tx.enrollment.update({
              where: { id: sameYearEnrollment.id },
              data: { classId: data.classId }
            })
          } else {
            await tx.enrollment.create({
              data: {
                studentId: studentProfile.id,
                classId: data.classId,
                academicYear: targetAcademicYear
              }
            })
          }
        }
      }
    })

    return reply.send({ success: true, message: 'Student updated successfully' })
  } catch (error: any) {
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: 'Failed to update student' })
  }
}

/**
 * DELETE /api/students/:id
 */
export const deleteStudent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string }
    const { role, schoolId } = await request.jwtVerify<{ role: string; schoolId: string }>()

    // RBAC: Only Directors and Principals can delete students
    if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized. Only Directors or Principals can manage students.' })
    }

    const existing = await prisma.user.findFirst({
      where: { id, schoolId, role: 'STUDENT', deletedAt: null }
    })

    if (!existing) {
      console.warn(`[StudentDelete] Student not found or unauthorized: ID=${id}, SchoolID=${schoolId}`)
      return reply.status(404).send({ success: false, error: 'Student not found', errorCode: 'NOT_FOUND' })
    }

    console.log(`[StudentDelete] Attempting to delete student: ${id} (${existing.firstName} ${existing.lastName})`)

    // Soft delete the User record
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: 'admin'
      }
    })

    console.log(`[StudentDelete] Successfully soft-deleted student: ${id}`)
    return reply.send({ success: true, message: 'Student deleted successfully' })
  } catch (error: any) {
    console.error('[StudentDelete] FATAL ERROR:', error)
    
    // Check if it's a known Prisma error
    if (error.code) {
      return reply.status(500).send({ 
        success: false, 
        error: 'Database constraint violation during deletion.', 
        errorCode: error.code,
        message: error.meta?.cause || 'A related record is preventing this deletion.'
      })
    }
    
    return reply.status(500).send({ success: false, error: 'Failed to delete student permanently due to server error', errorCode: 'INTERNAL_SERVER_ERROR' })
  }
}
