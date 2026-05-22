import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'

const attendanceSchema = z.object({
  userId: z.string(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  date: z.string(),
  note: z.string().optional(),
})

const bulkAttendanceSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(1),
  records: z.array(z.object({
    userId: z.string().min(1),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    note: z.string().optional(),
  }))
})

const allowedAttendanceViewTargets: Record<string, string[]> = {
  DIRECTOR: ['PRINCIPAL'],
  PRINCIPAL: ['TEACHER'],
  TEACHER: ['STUDENT'],
  STUDENT: ['STUDENT'],
}

function getExpectedAttendanceTargetRole(role: string): 'PRINCIPAL' | 'TEACHER' | 'STUDENT' | null {
  if (role === 'DIRECTOR') return 'PRINCIPAL'
  if (role === 'PRINCIPAL') return 'TEACHER'
  if (role === 'TEACHER') return 'STUDENT'
  return null
}

function normalizeAttendanceDateInput(input: string) {
  const value = String(input || '').trim()
  if (!value) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setUTCHours(0, 0, 0, 0)
  return parsed
}

async function getTeacherStudentScope(schoolId: string, userId: string, classId?: string) {
  const staff = await prisma.staff.findUnique({
    where: { userId },
    select: { id: true }
  })

  if (!staff) {
    return { allowedUserIds: [] as string[] }
  }

  const assignedClasses = await prisma.class.findMany({
    where: {
      classTeacherId: staff.id,
      schoolId,
      ...(classId ? { id: classId } : {})
    },
    select: { id: true }
  })

  const classIds = assignedClasses.map(c => c.id)
  if (classIds.length === 0) {
    return { allowedUserIds: [] as string[] }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds } },
    select: { student: { select: { userId: true } } }
  })

  return {
    allowedUserIds: enrollments.map(e => e.student.userId)
  }
}

/**
 * GET /api/attendance
 * List attendance records based on role and date range
 */
export const getAttendance = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, role, id: userId } = await request.jwtVerify<{ schoolId: string, role: string, id: string }>()
    const { date, targetRole, classId } = request.query as { date?: string, targetRole?: string, classId?: string }

    const allowedTargets = allowedAttendanceViewTargets[role]
    if (!allowedTargets) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const effectiveTargetRole = targetRole || allowedTargets[0]
    if (!allowedTargets.includes(effectiveTargetRole)) {
      return reply.status(403).send({ error: 'You are not allowed to view attendance for this role scope.' })
    }

    const where: any = { schoolId, targetRole: effectiveTargetRole }

    if (role === 'STUDENT') {
      where.userId = userId
    }

    if (role === 'TEACHER') {
      const { allowedUserIds } = await getTeacherStudentScope(schoolId, userId, classId)
      if (allowedUserIds.length === 0) {
        return reply.send([])
      }

      where.userId = { in: allowedUserIds }
    }

    if (date) {
      const startOfDay = normalizeAttendanceDateInput(date)
      if (!startOfDay) {
        return reply.status(400).send({ error: 'Invalid date format' })
      }
      const endOfDay = new Date(startOfDay)
      endOfDay.setUTCHours(23, 59, 59, 999)

      where.date = {
        gte: startOfDay,
        lte: endOfDay
      }
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        user: {
          select: { firstName: true, lastName: true, role: true, email: true }
        },
        markedBy: {
          select: { firstName: true, lastName: true, role: true }
        }
      },
      orderBy: { date: 'desc' }
    })

    return reply.send(records)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch attendance' })
  }
}

/**
 * POST /api/attendance
 * Mark attendance for a user with strict hierarchy enforcement
 */
export const markAttendance = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, id: markedById, role } = await request.jwtVerify<{ schoolId: string, id: string, role: string }>()
    const { userId, status, date, note } = attendanceSchema.parse(request.body)

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })

    if (!targetUser || targetUser.schoolId !== schoolId) {
      return reply.status(404).send({ error: 'User not found in your school entity' })
    }

    // STRICT HIERARCHY ENFORCEMENT
    if (role === 'DIRECTOR') {
      if (targetUser.role !== 'PRINCIPAL') {
        return reply.status(403).send({ error: 'Directors can only mark Principal attendance in this workflow' })
      }
    } else if (role === 'PRINCIPAL') {
      if (targetUser.role !== 'TEACHER') {
        return reply.status(403).send({ error: 'Principals can only mark Teacher attendance in this workflow' })
      }
    } else if (role === 'TEACHER') {
      if (targetUser.role !== 'STUDENT') {
        return reply.status(403).send({ error: 'Teachers can only mark Student attendance' })
      }
      // Verify teacher is class teacher for this student's class
      const staff = await prisma.staff.findUnique({ where: { userId: markedById }, select: { id: true } })
      if (!staff) {
        return reply.status(403).send({ error: 'Staff profile not found' })
      }
      const assignedClasses = await prisma.class.findMany({
        where: { classTeacherId: staff.id, schoolId },
        select: { id: true }
      })
      const classIds = assignedClasses.map(c => c.id)

      // Check if student is enrolled in one of teacher's classes
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          student: { userId: targetUser.id },
          classId: { in: classIds }
        }
      })
      if (!enrollment) {
        return reply.status(403).send({ error: 'This student is not in your assigned class' })
      }
    } else {
      return reply.status(403).send({ error: 'Access denied. You do not have permission to mark attendance.' })
    }

    // Date Normalization (Midnight UTC)
    const normalizedDate = normalizeAttendanceDateInput(date)
    if (!normalizedDate) {
      return reply.status(400).send({ error: 'Invalid date format' })
    }

    const saved = await prisma.attendance.upsert({
      where: {
        schoolId_userId_targetRole_date: {
          schoolId,
          userId,
          targetRole: targetUser.role,
          date: normalizedDate
        }
      },
      update: {
        status,
        note: note || null,
        markedById,
        markedByRole: role
      },
      create: {
        userId,
        targetRole: targetUser.role,
        markedById,
        markedByRole: role,
        schoolId,
        status,
        date: normalizedDate,
        note: note || null
      }
    })

    return reply.send({
      message: 'Attendance record saved successfully',
      id: saved.id
    })
  } catch (error: any) {
    console.error('Mark Attendance Error:', error)
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: error.issues })
    }
    return reply.status(500).send({ error: 'System failure during attendance commit' })
  }
}

/**
 * POST /api/attendance/bulk
 * Bulk mark attendance for multiple students (Teacher workflow)
 */
export const bulkMarkAttendance = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId, id: markedById, role } = await request.jwtVerify<{ schoolId: string, id: string, role: string }>()

    if (role !== 'TEACHER' && role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Access denied' })
    }

    const parsed = bulkAttendanceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const { classId, date, records } = parsed.data

    // If teacher, verify they own this class
    if (role === 'TEACHER') {
      const staff = await prisma.staff.findUnique({ where: { userId: markedById }, select: { id: true } })
      if (!staff) return reply.status(404).send({ error: 'Staff profile not found' })

      const targetClass = await prisma.class.findFirst({
        where: { id: classId, classTeacherId: staff.id, schoolId }
      })
      if (!targetClass) {
        return reply.status(403).send({ error: 'You are not the class teacher for this class' })
      }

      // Verify all target students are in this class
      const enrolledStudents = await prisma.enrollment.findMany({
        where: { classId },
        select: { student: { select: { userId: true } } }
      })
      const enrolledUserIds = new Set(enrolledStudents.map(e => e.student.userId))

      for (const r of records) {
        if (!enrolledUserIds.has(r.userId)) {
          return reply.status(403).send({ error: `Student ${r.userId} is not enrolled in this class` })
        }
      }
    }

    const normalizedDate = normalizeAttendanceDateInput(date)
    if (!normalizedDate) {
      return reply.status(400).send({ error: 'Invalid date format' })
    }

    const expectedTargetRole = getExpectedAttendanceTargetRole(role)
    if (!expectedTargetRole) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (role === 'DIRECTOR' || role === 'PRINCIPAL') {
      const validTargets = await prisma.user.findMany({
        where: {
          schoolId,
          role: expectedTargetRole,
          id: { in: records.map(r => r.userId) }
        },
        select: { id: true }
      })
      const validTargetIds = new Set(validTargets.map(target => target.id))

      for (const entry of records) {
        if (!validTargetIds.has(entry.userId)) {
          return reply.status(403).send({ error: 'One or more selected users are outside your attendance scope' })
        }
      }
    }

    const upserted = await prisma.$transaction(async (tx) => {
      const saved: any[] = []
      for (const entry of records) {
        const record = await tx.attendance.upsert({
          where: {
            schoolId_userId_targetRole_date: {
              schoolId,
              userId: entry.userId,
              targetRole: expectedTargetRole,
              date: normalizedDate
            }
          },
          update: {
            status: entry.status,
            note: entry.note || null,
            markedById,
            markedByRole: role
          },
          create: {
            userId: entry.userId,
            targetRole: expectedTargetRole,
            markedById,
            markedByRole: role,
            schoolId,
            status: entry.status,
            date: normalizedDate,
            note: entry.note || null
          }
        })
        saved.push(record)
      }
      return saved
    })

    return reply.status(201).send({
      message: `${upserted.length} attendance records saved`,
      count: upserted.length
    })
  } catch (error: any) {
    console.error('Bulk attendance error:', error)
    return reply.status(500).send({ error: 'Failed to save bulk attendance' })
  }
}

/**
 * GET /api/attendance/stats
 * Aggregates attendance percentages for the last 7 days
 */
export const getAttendanceStats = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { schoolId } = await request.jwtVerify<{ schoolId: string }>()
    
    // Get last 7 days
    const stats = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setUTCHours(0, 0, 0, 0)
      
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const dailyRecords = await prisma.attendance.findMany({
        where: {
          schoolId,
          targetRole: 'STUDENT',
          date: {
            gte: date,
            lt: nextDay
          }
        }
      })

      if (dailyRecords.length === 0) {
        stats.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          percentage: 0,
          fullDate: date.toISOString().split('T')[0]
        })
        continue
      }

      const present = dailyRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length
      const percentage = Math.round((present / dailyRecords.length) * 100)

      stats.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        percentage,
        fullDate: date.toISOString().split('T')[0]
      })
    }

    return reply.send(stats)
  } catch (error: any) {
    console.error('Attendance stats error:', error)
    return reply.status(500).send({ error: 'Failed to fetch attendance statistics' })
  }
}
