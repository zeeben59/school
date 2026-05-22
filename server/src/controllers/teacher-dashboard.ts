import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import { Prisma } from '@prisma/client'

// ═══════════════════════════════════════════════
// GET /api/teacher/dashboard
// Teacher-specific dashboard summary
// ═══════════════════════════════════════════════
export const getTeacherDashboard = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()

    // Find teacher's staff profile
    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    // Get classes where this teacher is class teacher
    const assignedClasses = await prisma.class.findMany({
      where: { classTeacherId: staff.id, schoolId },
      select: {
        id: true,
        name: true,
        level: true,
        arm: true,
        _count: { select: { enrollments: true } }
      },
      orderBy: { name: 'asc' }
    })

    // Get subjects assigned to this teacher
    const assignedSubjects = await prisma.subject.findMany({
      where: { teacherId: staff.id, schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        classId: true,
        class: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    })

    // Count total students across assigned classes
    const classIds = assignedClasses.map(c => c.id)
    const totalStudents = classIds.length > 0
      ? await prisma.enrollment.count({
          where: { classId: { in: classIds } }
        })
      : 0

    // Recent notices for this school
    const notices = await prisma.notice.findMany({
      where: {
        schoolId,
        OR: [
          { targetRole: 'ALL' },
          { targetRole: 'TEACHER' }
        ]
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // Today's attendance count for teacher's classes
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    let attendanceToday = { present: 0, absent: 0, total: 0 }
    if (classIds.length > 0) {
      // Get student user IDs from enrolled students
      const enrolledStudents = await prisma.enrollment.findMany({
        where: { classId: { in: classIds } },
        select: { student: { select: { userId: true } } }
      })
      const studentUserIds = enrolledStudents.map(e => e.student.userId)

      if (studentUserIds.length > 0) {
        const todayAttendance = await prisma.attendance.findMany({
          where: {
            schoolId,
            userId: { in: studentUserIds },
            targetRole: 'STUDENT',
            date: { gte: today, lt: tomorrow }
          },
          select: { status: true }
        })
        attendanceToday = {
          present: todayAttendance.filter(a => a.status === 'PRESENT').length,
          absent: todayAttendance.filter(a => a.status === 'ABSENT' || a.status === 'LATE').length,
          total: studentUserIds.length
        }
      }
    }

    return reply.send({
      assignedClasses,
      assignedSubjects,
      totalStudents,
      totalClasses: assignedClasses.length,
      totalSubjects: assignedSubjects.length,
      isClassTeacher: assignedClasses.length > 0,
      classTeacherOf: assignedClasses.map(c => c.name),
      attendanceToday,
      notices
    })
  } catch (error: any) {
    console.error('Teacher dashboard error:', error)
    return reply.status(500).send({ error: 'Failed to load teacher dashboard' })
  }
}

// ═══════════════════════════════════════════════
// GET /api/teacher/my-classes
// Classes where teacher is assigned as class teacher
// ═══════════════════════════════════════════════
export const getMyClasses = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()

    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    const classes = await prisma.class.findMany({
      where: { classTeacherId: staff.id, schoolId },
      select: {
        id: true,
        name: true,
        level: true,
        arm: true,
        _count: { select: { enrollments: true, subjects: true } }
      },
      orderBy: { name: 'asc' }
    })

    return reply.send(classes)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch assigned classes' })
  }
}

// ═══════════════════════════════════════════════
// GET /api/teacher/my-subjects
// Subjects assigned to this teacher
// ═══════════════════════════════════════════════
export const getMySubjects = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()

    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    const subjects = await prisma.subject.findMany({
      where: { teacherId: staff.id, schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        classId: true,
        class: {
          select: {
            id: true,
            name: true,
            _count: { select: { enrollments: true } }
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return reply.send(subjects)
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch assigned subjects' })
  }
}

// ═══════════════════════════════════════════════
// GET /api/teacher/my-students?classId=xxx
// Students enrolled in teacher's assigned class
// ═══════════════════════════════════════════════
export const getMyStudents = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()
    const { classId } = request.query as { classId?: string }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    // Get teacher's assigned classes
    const assignedClasses = await prisma.class.findMany({
      where: { classTeacherId: staff.id, schoolId },
      select: { id: true }
    })

    // Get teacher's assigned subjects to find classes they teach in
    const assignedSubjects = await prisma.subject.findMany({
      where: { teacherId: staff.id, schoolId, classId: { not: null } },
      select: { classId: true }
    })
    
    // Combine explicit class ownership + taught subject classes
    const validClassIds = new Set([
      ...assignedClasses.map(c => c.id),
      ...assignedSubjects.map(s => s.classId as string)
    ])

    if (validClassIds.size === 0) {
      return reply.send([])
    }

    // If classId is specified, verify teacher has access
    if (classId && !validClassIds.has(classId)) {
      return reply.status(403).send({ error: 'You do not teach this class' })
    }

    const targetClassIds = classId ? [classId] : Array.from(validClassIds)

    // Get enrollments with student data
    const enrollments = await prisma.enrollment.findMany({
      where: { classId: { in: targetClassIds } },
      select: {
        id: true,
        classId: true,
        academicYear: true,
        class: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            admissionNo: true,
            gender: true,
            dateOfBirth: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                createdById: true,
                createdByRole: true
              }
            }
          }
        }
      },
      orderBy: { student: { user: { firstName: 'asc' } } }
    })

    return reply.send(enrollments)
  } catch (error: any) {
    console.error('My students error:', error)
    return reply.status(500).send({ error: 'Failed to fetch students' })
  }
}

// ═══════════════════════════════════════════════
// POST /api/teacher/students
// Teacher creates a new student in their assigned class
// ═══════════════════════════════════════════════
const createStudentSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  admissionNo: z.string().min(1, 'Admission number is required'),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  classId: z.string().min(1, 'Class assignment is required'),
  academicYear: z.string().optional(),
})

function handleUniqueConstraintError(error: any, reply: FastifyReply) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : String(error.meta?.target || '')

    if (target.includes('schoolId') && target.includes('email')) {
      return reply.status(409).send({ error: 'Email already exists in this school' })
    }

    if (target.includes('schoolId') && target.includes('admissionNo')) {
      return reply.status(409).send({ error: 'This admission number is already taken in your school' })
    }
  }

  return null
}

export const teacherCreateStudent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: creatorId, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()

    const staff = await prisma.staff.findUnique({
      where: { userId: creatorId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    const parsed = createStudentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message }))
      })
    }

    const { firstName, lastName, email, password, admissionNo, gender, dateOfBirth, classId, academicYear } = parsed.data

    // Verify teacher is the class teacher for the specified class
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, classTeacherId: staff.id, schoolId }
    })

    if (!targetClass) {
      return reply.status(403).send({ error: 'You can only add students to classes you are assigned to as class teacher' })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({ where: { email, schoolId, deletedAt: null } })
    if (existingUser) {
      return reply.status(409).send({ error: 'Email already exists in this school' })
    }

    // Check if admission number already exists
    const existingAdmission = await prisma.student.findFirst({ where: { admissionNo, schoolId } })
    if (existingAdmission) {
      return reply.status(409).send({ error: 'This admission number is already taken in your school' })
    }

    const hashedPassword = await bcrypt.hash(password || 'student123', 10)
    const currentYear = academicYear || getDefaultAcademicYear()

    // Create user + student profile + enrollment in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'STUDENT',
          status: 'ACTIVE',
          schoolId,
          createdById: creatorId,
          createdByRole: 'TEACHER',
        }
      })

      const student = await tx.student.create({
        data: {
          userId: user.id,
          schoolId,
          admissionNo,
          gender: gender || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        }
      })

      // Auto-enroll in the teacher's class
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: student.id,
          classId,
          academicYear: currentYear,
        }
      })

      return { user, student, enrollment }
    })

    return reply.status(201).send({
      message: 'Student created and enrolled successfully',
      student: {
        id: result.student.id,
        userId: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        admissionNo: result.student.admissionNo,
        classId: classId,
        className: targetClass.name,
      }
    })
  } catch (error: any) {
    console.error('Teacher create student error:', error)
    const handled = handleUniqueConstraintError(error, reply)
    if (handled) return handled
    return reply.status(500).send({ error: 'Failed to create student' })
  }
}

// ═══════════════════════════════════════════════
// POST /api/teacher/enroll
// Teacher enrolls an existing student into their class
// ═══════════════════════════════════════════════
const enrollSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  academicYear: z.string().optional(),
})

const getDefaultAcademicYear = () => `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`

export const teacherEnrollStudent = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()

    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    const parsed = enrollSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues })
    }

    const { studentId, classId, academicYear } = parsed.data

    // Verify teacher is the class teacher
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, classTeacherId: staff.id, schoolId }
    })

    if (!targetClass) {
      return reply.status(403).send({ error: 'You can only enroll students into classes you are assigned to' })
    }

    // Verify student belongs to same school
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId }
    })

    if (!student) {
      return reply.status(404).send({ error: 'Student not found in your school' })
    }

    const currentYear = academicYear || getDefaultAcademicYear()

    const otherClassEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId,
        academicYear: currentYear,
        classId: { not: classId }
      },
      include: {
        class: { select: { name: true } }
      }
    })

    if (otherClassEnrollment) {
      return reply.status(409).send({
        error: `Student is already assigned to ${otherClassEnrollment.class.name} for ${currentYear}`
      })
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId,
        classId,
        academicYear: currentYear,
      }
    })

    return reply.status(201).send({
      message: `Student enrolled into ${targetClass.name}`,
      enrollment
    })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return reply.status(409).send({ error: 'Student is already enrolled in this class for this academic year' })
    }
    return reply.status(500).send({ error: 'Failed to enroll student' })
  }
}

export const getAvailableStudentsForEnrollment = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()
    const { classId, academicYear, search } = request.query as { classId?: string; academicYear?: string; search?: string }

    if (!classId) {
      return reply.status(400).send({ error: 'Class ID is required' })
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      select: { id: true }
    })

    if (!staff) {
      return reply.status(404).send({ error: 'Staff profile not found' })
    }

    const targetClass = await prisma.class.findFirst({
      where: { id: classId, classTeacherId: staff.id, schoolId },
      select: { id: true }
    })

    if (!targetClass) {
      return reply.status(403).send({ error: 'You can only enroll students into your assigned class' })
    }

    const targetAcademicYear = academicYear || getDefaultAcademicYear()
    const blockedStudentIds = await prisma.enrollment.findMany({
      where: { academicYear: targetAcademicYear },
      select: { studentId: true }
    })

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        id: { notIn: blockedStudentIds.map((entry) => entry.studentId) },
        OR: search
          ? [
              { admissionNo: { contains: search } },
              { user: { firstName: { contains: search } } },
              { user: { lastName: { contains: search } } },
              { user: { email: { contains: search } } }
            ]
          : undefined
      },
      select: {
        id: true,
        admissionNo: true,
        gender: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [{ user: { firstName: 'asc' } }]
    })

    return reply.send(students)
  } catch (error: any) {
    console.error('Available students error:', error)
    return reply.status(500).send({ error: 'Failed to fetch available students' })
  }
}
