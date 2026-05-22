import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import { getResultDocumentsDirectory } from '../utils/upload-paths.js'

const RESULT_DOCUMENTS_DIR = getResultDocumentsDirectory()
const MAX_RESULT_PDF_SIZE_BYTES = 5 * 1024 * 1024

const AFFECTIVE_TRAITS = ['Punctuality', 'Attendance', 'Neatness', 'Honesty', 'Teamwork']
const PSYCHOMOTOR_TRAITS = ['Handwriting', 'Sports', 'Creativity', 'Practical Skills', 'Communication']

// Grade calculation helper
function calculateGrade(total: number | null): string {
  if (total === null || total === undefined) return '-'
  if (total >= 70) return 'A'
  if (total >= 60) return 'B'
  if (total >= 50) return 'C'
  if (total >= 40) return 'D'
  return 'F'
}

async function getTeacherStaffId(userId: string) {
  const staff = await prisma.staff.findUnique({
    where: { userId },
    select: { id: true }
  })

  return staff?.id || null
}

function buildSubjectRemark(grade: string | null) {
  switch (grade) {
    case 'A': return 'Excellent'
    case 'B': return 'Very Good'
    case 'C': return 'Good'
    case 'D': return 'Fair'
    case 'F': return 'Needs Improvement'
    default: return '-'
  }
}

function calculateGradePoint(average: number) {
  if (average >= 70) return 5
  if (average >= 60) return 4
  if (average >= 50) return 3
  if (average >= 40) return 2
  return 1
}

function calculateAge(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDelta = today.getMonth() - dateOfBirth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1
  }
  return age
}

async function ensureStudentTermReport(params: {
  studentId: string
  classId: string
  schoolId: string
  academicYear: string
  term: string
}) {
  const report = await (prisma as any).studentTermReport.upsert({
    where: {
      studentId_classId_academicYear_term: {
        studentId: params.studentId,
        classId: params.classId,
        academicYear: params.academicYear,
        term: params.term
      }
    },
    create: {
      studentId: params.studentId,
      classId: params.classId,
      schoolId: params.schoolId,
      academicYear: params.academicYear,
      term: params.term
    },
    update: {}
  })

  const existingSkills = await (prisma as any).studentReportSkill.findMany({
    where: { reportId: report.id },
    select: { category: true, trait: true }
  })

  const existingSkillKeys = new Set(existingSkills.map((skill: any) => `${skill.category}:${skill.trait}`))
  const missingSkills = [
    ...AFFECTIVE_TRAITS.map((trait) => ({ category: 'AFFECTIVE', trait })),
    ...PSYCHOMOTOR_TRAITS.map((trait) => ({ category: 'PSYCHOMOTOR', trait }))
  ].filter((skill) => !existingSkillKeys.has(`${skill.category}:${skill.trait}`))

  if (missingSkills.length > 0) {
    await (prisma as any).studentReportSkill.createMany({
      data: missingSkills.map((skill) => ({
        reportId: report.id,
        category: skill.category,
        trait: skill.trait,
        rating: null
      }))
    })
  }

  return report
}

async function assertWritableResultScope(params: {
  userId: string
  role: string
  schoolId: string
  studentId: string
  subjectId: string
  classId: string
}) {
  if (params.role !== 'TEACHER' && params.role !== 'DIRECTOR' && params.role !== 'PRINCIPAL') {
    return { ok: false, status: 403, error: 'Unauthorized to modify results' }
  }

  const [student, subject, cls] = await Promise.all([
    prisma.student.findFirst({
      where: { id: params.studentId, schoolId: params.schoolId },
      select: { id: true }
    }),
    prisma.subject.findFirst({
      where: { id: params.subjectId, schoolId: params.schoolId },
      select: { id: true, teacherId: true, classId: true }
    }),
    prisma.class.findFirst({
      where: { id: params.classId, schoolId: params.schoolId },
      select: { id: true }
    })
  ])

  if (!student) return { ok: false, status: 404, error: 'Student not found in this school' }
  if (!subject) return { ok: false, status: 404, error: 'Subject not found in this school' }
  if (!cls) return { ok: false, status: 404, error: 'Class not found in this school' }

  if (subject.classId && subject.classId !== params.classId) {
    return { ok: false, status: 400, error: 'Selected subject does not belong to the chosen class' }
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      studentId: params.studentId,
      classId: params.classId
    },
    select: { id: true }
  })

  if (!enrollment) {
    return { ok: false, status: 400, error: 'Student is not enrolled in the selected class' }
  }

  if (params.role === 'TEACHER') {
    const staffId = await getTeacherStaffId(params.userId)
    if (!staffId) return { ok: false, status: 404, error: 'Staff profile not found' }
    if (subject.teacherId !== staffId) {
      return { ok: false, status: 403, error: 'You can only upload results for subjects assigned to you' }
    }
  }

  return { ok: true as const }
}

function normalizeTerm(value: string | undefined) {
  return value?.trim() || ''
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getResultUploadErrorResponse(error: any) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('only pdf files are allowed')) {
    return { status: 400, error: 'Only PDF files are allowed' }
  }
  if (message.includes('5mb upload limit') || message.includes('file too large')) {
    return { status: 400, error: 'File too large. Max 5MB.' }
  }
  return { status: 500, error: 'Failed to upload result PDF' }
}

function safeUnlink(filePath: string | null | undefined) {
  if (!filePath) return
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error('Failed to delete file:', filePath, error)
  }
}

function isPathWithinBase(filePath: string, baseDir: string) {
  const resolvedBase = path.resolve(baseDir)
  const resolvedPath = path.resolve(filePath)
  return resolvedPath === resolvedBase || resolvedPath.startsWith(`${resolvedBase}${path.sep}`)
}

async function savePdfToDisk(part: any, schoolId: string) {
  const ext = path.extname(part.filename || '').toLowerCase()
  if (part.mimetype !== 'application/pdf' && ext !== '.pdf') {
    throw new Error('Only PDF files are allowed')
  }

  const uniqueSegment = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const fileName = `result_document_${schoolId}_${uniqueSegment}.pdf`
  const filePath = path.join(RESULT_DOCUMENTS_DIR, fileName)
  let totalBytes = 0

  const byteCounter = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length
      if (totalBytes > MAX_RESULT_PDF_SIZE_BYTES) {
        callback(new Error('PDF exceeds the 5MB upload limit'))
        return
      }
      callback(null, chunk)
    }
  })

  await pipeline(part.file, byteCounter, fs.createWriteStream(filePath))

  return {
    fileName,
    filePath,
    fileUrl: `/uploads/result-documents/${fileName}`,
    originalFileName: sanitizeFileName(part.filename || 'result.pdf'),
    size: totalBytes
  }
}

async function getTeacherStaffRecord(userId: string, schoolId: string) {
  return prisma.staff.findFirst({
    where: { userId, schoolId },
    select: { id: true }
  })
}

function buildResultDocumentResponse(document: any) {
  return {
    id: document.id,
    studentId: document.studentId,
    classId: document.classId,
    subjectId: document.subjectId,
    schoolId: document.schoolId,
    academicYear: document.academicYear,
    term: document.term,
    originalFileName: document.originalFileName,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    uploadedByRole: document.uploadedByRole,
    student: document.student ? {
      id: document.student.id,
      admissionNo: document.student.admissionNo,
      name: `${document.student.user.firstName} ${document.student.user.lastName}`
    } : undefined,
    class: document.class ? {
      id: document.class.id,
      name: document.class.name
    } : undefined,
    subject: document.subject ? {
      id: document.subject.id,
      name: document.subject.name,
      code: document.subject.code
    } : undefined,
    viewUrl: `/api/results/documents/${document.id}/file`,
    downloadUrl: `/api/results/documents/${document.id}/file?download=1`
  }
}

// ═══════════════════════════════════════════════
// GET /api/results?classId=&subjectId=&term=&academicYear=
// Get results — teacher sees own subjects, director/principal sees all
// ═══════════════════════════════════════════════
export const getResults = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    const { classId, subjectId, term, academicYear } = request.query as {
      classId?: string; subjectId?: string; term?: string; academicYear?: string
    }

    const where: any = { schoolId }

    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId
    if (term) where.term = term
    if (academicYear) where.academicYear = academicYear

    // If teacher, restrict to their assigned subjects only
    if (role === 'TEACHER') {
      const staff = await prisma.staff.findUnique({
        where: { userId },
        select: { id: true }
      })
      if (!staff) return reply.status(404).send({ error: 'Staff profile not found' })

      const teacherSubjects = await prisma.subject.findMany({
        where: { teacherId: staff.id, schoolId },
        select: { id: true }
      })
      const subjectIds = teacherSubjects.map(s => s.id)

      if (subjectId && !subjectIds.includes(subjectId)) {
        return reply.status(403).send({ error: 'You can only view results for your assigned subjects' })
      }

      where.subjectId = subjectId ? subjectId : { in: subjectIds }
    } else if (role === 'STUDENT') {
      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true }
      })
      if (!student) return reply.status(404).send({ error: 'Student profile not found' })
      where.studentId = student.id
    }

    const results = await prisma.result.findMany({
      where,
      select: {
        id: true,
        firstTest: true,
        secondTest: true,
        exam: true,
        total: true,
        grade: true,
        term: true,
        academicYear: true,
        createdById: true,
        createdByRole: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } }
      },
      orderBy: [{ class: { name: 'asc' } }, { student: { user: { firstName: 'asc' } } }]
    })

    return reply.send(results)
  } catch (error: any) {
    console.error('Get results error:', error)
    return reply.status(500).send({ error: 'Failed to fetch results' })
  }
}

export const getResultSlip = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    const { academicYear, term, studentId: requestedStudentId } = request.query as {
      academicYear?: string
      term?: string
      studentId?: string
    }

    if (!academicYear || !term) {
      return reply.status(400).send({ error: 'Academic year and term are required' })
    }

    let studentId = requestedStudentId
    if (role === 'STUDENT') {
      const studentProfile = await prisma.student.findUnique({
        where: { userId },
        select: { id: true }
      })
      if (!studentProfile) {
        return reply.status(404).send({ error: 'Student profile not found' })
      }
      studentId = studentProfile.id
    }

    if (!studentId) {
      return reply.status(400).send({ error: 'Student ID is required' })
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        id: true,
        admissionNo: true,
        gender: true,
        dateOfBirth: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        school: {
          select: {
            name: true,
            logoUrl: true,
            address: true,
            phone: true
          }
        },
        enrollments: {
          select: {
            academicYear: true,
            class: {
              select: {
                id: true,
                name: true,
                classTeacher: {
                  select: {
                    user: {
                      select: { firstName: true, lastName: true }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!student) {
      return reply.status(404).send({ error: 'Student not found in this school' })
    }

    const termResults = await prisma.result.findMany({
      where: {
        schoolId,
        studentId,
        academicYear,
        term
      },
      select: {
        id: true,
        firstTest: true,
        secondTest: true,
        exam: true,
        total: true,
        grade: true,
        subject: {
          select: {
            name: true,
            code: true,
            teacher: {
              select: {
                user: {
                  select: { firstName: true, lastName: true }
                }
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ subject: { name: 'asc' } }]
    })

    const matchingEnrollment = student.enrollments.find((enrollment) => enrollment.academicYear === academicYear)
    const activeClass = termResults[0]?.class || matchingEnrollment?.class
    if (!activeClass) {
      if (student.enrollments.length === 0) {
        return reply.status(404).send({ error: 'Student has not been enrolled in any class yet' })
      }

      return reply.status(404).send({ error: 'Student has no class assignment for the selected academic session' })
    }

    if (termResults.length === 0) {
      return reply.status(404).send({ error: 'No results found for the selected term and academic session' })
    }

    const report = await ensureStudentTermReport({
      studentId,
      classId: activeClass.id,
      schoolId,
      academicYear,
      term
    })

    const reportWithSkills = await (prisma as any).studentTermReport.findUnique({
      where: { id: report.id },
      include: { skills: true }
    })

    const classSize = await prisma.enrollment.count({
      where: {
        classId: activeClass.id,
        academicYear
      }
    })

    const groupedTotals = await (prisma as any).result.groupBy({
      by: ['studentId'],
      where: {
        schoolId,
        classId: activeClass.id,
        academicYear,
        term
      },
      _sum: { total: true }
    })

    const rankedStudents = groupedTotals
      .map((item: any) => ({ studentId: item.studentId, totalScore: item._sum.total || 0 }))
      .sort((a: any, b: any) => b.totalScore - a.totalScore)

    const studentRank = rankedStudents.findIndex((item: any) => item.studentId === studentId) + 1
    const totalScore = termResults.reduce((sum, result) => sum + (result.total || 0), 0)
    const averageScore = termResults.length > 0 ? totalScore / termResults.length : 0
    const gradePoint = termResults.length > 0 ? calculateGradePoint(averageScore) : 0

    const feeSummary = await prisma.fee.aggregate({
      where: { studentId, schoolId },
      _sum: { amount: true, paidAmount: true, balance: true }
    })

    const subjectRows = termResults.map((result) => {
      const teacherName = result.subject.teacher?.user
        ? `${result.subject.teacher.user.firstName} ${result.subject.teacher.user.lastName}`
        : 'Subject Teacher'

      return {
        id: result.id,
        subject: result.subject.name,
        subjectCode: result.subject.code,
        continuousAssessment: (result.firstTest || 0) + (result.secondTest || 0),
        firstTest: result.firstTest,
        secondTest: result.secondTest,
        exam: result.exam,
        total: result.total,
        grade: result.grade,
        remark: buildSubjectRemark(result.grade),
        teacher: teacherName
      }
    })

    return reply.send({
      school: student.school,
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        gender: student.gender,
        age: calculateAge(student.dateOfBirth),
        admissionNo: student.admissionNo,
        rollNumber: reportWithSkills?.rollNumber || student.admissionNo,
        email: student.user.email
      },
      report: {
        term,
        academicYear,
        className: activeClass.name,
        position: studentRank > 0 ? studentRank : null,
        classSize,
        totalScore,
        averageScore: Number(averageScore.toFixed(2)),
        gradePoint,
        resultSummary: `${termResults.length} subjects recorded`,
        formTeacherComment: reportWithSkills?.formTeacherComment || '',
        principalComment: reportWithSkills?.principalComment || '',
        nextTermInfo: reportWithSkills?.nextTermInfo || '',
        feesInfo: reportWithSkills?.feesInfo || '',
        formTeacherName: matchingEnrollment?.class.classTeacher?.user
          ? `${matchingEnrollment.class.classTeacher.user.firstName} ${matchingEnrollment.class.classTeacher.user.lastName}`
          : '',
        principalName: 'Principal',
        feesSummary: {
          totalFees: feeSummary._sum.amount || 0,
          paidFees: feeSummary._sum.paidAmount || 0,
          balance: feeSummary._sum.balance || 0
        }
      },
      subjects: subjectRows,
      gradingKey: [
        { grade: 'A', range: '70 - 100', remark: 'Excellent' },
        { grade: 'B', range: '60 - 69', remark: 'Very Good' },
        { grade: 'C', range: '50 - 59', remark: 'Good' },
        { grade: 'D', range: '40 - 49', remark: 'Fair' },
        { grade: 'F', range: '0 - 39', remark: 'Needs Improvement' }
      ],
      affectiveSkills: (reportWithSkills?.skills || []).filter((skill: any) => skill.category === 'AFFECTIVE'),
      psychomotorSkills: (reportWithSkills?.skills || []).filter((skill: any) => skill.category === 'PSYCHOMOTOR')
    })
  } catch (error: any) {
    console.error('Result slip error:', error)
    return reply.status(500).send({ error: 'Failed to generate result slip' })
  }
}

export const listResultDocuments = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    const { classId, subjectId, term, academicYear, studentId } = request.query as {
      classId?: string
      subjectId?: string
      term?: string
      academicYear?: string
      studentId?: string
    }

    const where: any = { schoolId }
    if (classId) where.classId = classId
    if (subjectId) where.subjectId = subjectId
    if (term) where.term = term
    if (academicYear) where.academicYear = academicYear

    if (role === 'STUDENT') {
      const studentProfile = await prisma.student.findUnique({
        where: { userId },
        select: { id: true }
      })

      if (!studentProfile) {
        return reply.status(404).send({ error: 'Student profile not found' })
      }

      where.studentId = studentProfile.id
    } else if (role === 'TEACHER') {
      const staff = await getTeacherStaffRecord(userId, schoolId)
      if (!staff) {
        return reply.status(404).send({ error: 'Staff profile not found' })
      }

      where.subject = {
        teacherId: staff.id,
        schoolId
      }

      if (studentId) {
        where.studentId = studentId
      }
    } else if ((role === 'DIRECTOR' || role === 'PRINCIPAL') && studentId) {
      where.studentId = studentId
    }

    const documents = await (prisma as any).resultDocument.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: { id: true, name: true }
        },
        subject: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }]
    })

    return reply.send(documents.map(buildResultDocumentResponse))
  } catch (error) {
    console.error('List result documents error:', error)
    return reply.status(500).send({ error: 'Failed to fetch result documents' })
  }
}

export const uploadResultDocument = async (request: FastifyRequest, reply: FastifyReply) => {
  let uploadedFilePath: string | null = null

  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()

    if (role !== 'TEACHER' && role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized to upload result PDFs' })
    }

    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Request must be multipart/form-data' })
    }

    const payload: Record<string, string> = {}
    let uploadedFile: null | {
      fileName: string
      filePath: string
      fileUrl: string
      originalFileName: string
      size: number
    } = null

    const parts = request.parts()
    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname !== 'resultPdf') {
          part.file.resume()
          continue
        }

        uploadedFile = await savePdfToDisk(part, schoolId)
        uploadedFilePath = uploadedFile.filePath
      } else {
        payload[part.fieldname] = String(part.value ?? '').trim()
      }
    }

    if (!uploadedFile) {
      return reply.status(400).send({ error: 'A PDF result file is required' })
    }

    const parsed = z.object({
      studentId: z.string().min(1, 'Student is required'),
      subjectId: z.string().min(1, 'Subject is required'),
      classId: z.string().min(1, 'Class is required'),
      academicYear: z.string().min(1, 'Academic year is required'),
      term: z.string().min(1, 'Term is required')
    }).safeParse({
      studentId: payload.studentId,
      subjectId: payload.subjectId,
      classId: payload.classId,
      academicYear: payload.academicYear,
      term: normalizeTerm(payload.term)
    })

    if (!parsed.success) {
      safeUnlink(uploadedFilePath)
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message || 'Validation failed'
      })
    }

    const { studentId, subjectId, classId, academicYear, term } = parsed.data

    const scope = await assertWritableResultScope({
      userId,
      role,
      schoolId,
      studentId,
      subjectId,
      classId
    })

    if (!scope.ok) {
      safeUnlink(uploadedFilePath)
      return reply.status(scope.status).send({ error: scope.error })
    }

    const existingDocument = await (prisma as any).resultDocument.findUnique({
      where: {
        studentId_subjectId_classId_academicYear_term: {
          studentId,
          subjectId,
          classId,
          academicYear,
          term
        }
      },
      select: {
        id: true,
        filePath: true
      }
    })

    const document = await (prisma as any).resultDocument.upsert({
      where: {
        studentId_subjectId_classId_academicYear_term: {
          studentId,
          subjectId,
          classId,
          academicYear,
          term
        }
      },
      create: {
        studentId,
        subjectId,
        classId,
        schoolId,
        academicYear,
        term,
        fileUrl: uploadedFile.fileUrl,
        filePath: uploadedFile.filePath,
        originalFileName: uploadedFile.originalFileName,
        uploadedById: userId,
        uploadedByRole: role
      },
      update: {
        fileUrl: uploadedFile.fileUrl,
        filePath: uploadedFile.filePath,
        originalFileName: uploadedFile.originalFileName,
        uploadedById: userId,
        uploadedByRole: role
      },
      include: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: { id: true, name: true }
        },
        subject: {
          select: { id: true, name: true, code: true }
        }
      }
    })

    if (existingDocument?.filePath && existingDocument.filePath !== uploadedFile.filePath) {
      safeUnlink(existingDocument.filePath)
    }

    return reply.status(201).send({
      message: existingDocument
        ? 'Result PDF replaced successfully'
        : 'Result PDF uploaded successfully',
      document: buildResultDocumentResponse(document)
    })
  } catch (error: any) {
    safeUnlink(uploadedFilePath)
    console.error('Upload result document error:', error)
    const mapped = getResultUploadErrorResponse(error)
    return reply.status(mapped.status).send({ error: mapped.error })
  }
}

export const getResultDocumentFile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    const { id } = request.params as { id: string }
    const { download } = request.query as { download?: string }

    const document = await (prisma as any).resultDocument.findFirst({
      where: { id, schoolId },
      include: {
        student: {
          select: { userId: true }
        },
        subject: {
          select: { teacherId: true }
        }
      }
    })

    if (!document) {
      return reply.status(404).send({ error: 'Result PDF not found' })
    }

    if (role === 'STUDENT') {
      if (document.student.userId !== userId) {
        return reply.status(403).send({ error: 'You can only access your own result PDFs' })
      }
    } else if (role === 'TEACHER') {
      const staff = await getTeacherStaffRecord(userId, schoolId)
      if (!staff || document.subject.teacherId !== staff.id) {
        return reply.status(403).send({ error: 'You can only access result PDFs for subjects assigned to you' })
      }
    } else if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
      return reply.status(403).send({ error: 'Unauthorized to access this result PDF' })
    }

    if (!document.filePath || !isPathWithinBase(document.filePath, RESULT_DOCUMENTS_DIR)) {
      return reply.status(403).send({ error: 'Access denied' })
    }

    if (!fs.existsSync(document.filePath)) {
      return reply.status(404).send({ error: 'Stored PDF file not found' })
    }

    reply.type('application/pdf')
    reply.header(
      'Content-Disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${sanitizeFileName(document.originalFileName)}"`
    )

    const stream = fs.createReadStream(document.filePath)
    return reply.send(stream)
  } catch (error) {
    console.error('Get result document file error:', error)
    return reply.status(500).send({ error: 'Failed to fetch result PDF' })
  }
}

// ═══════════════════════════════════════════════
// POST /api/results
// Upload a single result (teacher only for own subjects)
// ═══════════════════════════════════════════════
const resultSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  academicYear: z.string().min(1),
  term: z.string().min(1),
  firstTest: z.number().min(0).max(100).nullable().optional(),
  secondTest: z.number().min(0).max(100).nullable().optional(),
  exam: z.number().min(0).max(100).nullable().optional(),
})

export const createResult = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()

    const parsed = resultSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message }))
      })
    }

    const { studentId, subjectId, classId, academicYear, term, firstTest, secondTest, exam } = parsed.data

    const scope = await assertWritableResultScope({
      userId,
      role,
      schoolId,
      studentId,
      subjectId,
      classId
    })
    if (!scope.ok) {
      return reply.status(scope.status).send({ error: scope.error })
    }

    // Calculate total and grade
    const ft = firstTest ?? 0
    const st = secondTest ?? 0
    const ex = exam ?? 0
    const total = ft + st + ex
    const grade = calculateGrade(total)

    // Upsert — update if exists, create if not
    const result = await prisma.result.upsert({
      where: {
        studentId_subjectId_classId_academicYear_term: {
          studentId, subjectId, classId, academicYear, term
        }
      },
      create: {
        studentId, subjectId, classId, schoolId, academicYear, term,
        firstTest: firstTest ?? null,
        secondTest: secondTest ?? null,
        exam: exam ?? null,
        total, grade,
        createdById: userId,
        createdByRole: role,
      },
      update: {
        firstTest: firstTest ?? null,
        secondTest: secondTest ?? null,
        exam: exam ?? null,
        total, grade,
        createdById: userId,
        createdByRole: role,
      }
    })

    await ensureStudentTermReport({ studentId, classId, schoolId, academicYear, term })

    return reply.status(201).send({ message: 'Result saved', result })
  } catch (error: any) {
    console.error('Create result error:', error)
    return reply.status(500).send({ error: 'Failed to save result' })
  }
}

// ═══════════════════════════════════════════════
// POST /api/results/batch
// Upload results for multiple students at once
// ═══════════════════════════════════════════════
const batchResultSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  academicYear: z.string().min(1),
  term: z.string().min(1),
  results: z.array(z.object({
    studentId: z.string().min(1),
    firstTest: z.number().min(0).max(100).nullable().optional(),
    secondTest: z.number().min(0).max(100).nullable().optional(),
    exam: z.number().min(0).max(100).nullable().optional(),
  }))
})

export const batchCreateResults = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()

    const parsed = batchResultSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message }))
      })
    }

    const { subjectId, classId, academicYear, term, results } = parsed.data

    for (const entry of results) {
      const scope = await assertWritableResultScope({
        userId,
        role,
        schoolId,
        studentId: entry.studentId,
        subjectId,
        classId
      })
      if (!scope.ok) {
        return reply.status(scope.status).send({ error: scope.error })
      }
    }

    // Process all results in a transaction
    const savedResults = await prisma.$transaction(
      results.map(r => {
        const ft = r.firstTest ?? 0
        const st = r.secondTest ?? 0
        const ex = r.exam ?? 0
        const total = ft + st + ex
        const grade = calculateGrade(total)

        return prisma.result.upsert({
          where: {
            studentId_subjectId_classId_academicYear_term: {
              studentId: r.studentId, subjectId, classId, academicYear, term
            }
          },
          create: {
            studentId: r.studentId, subjectId, classId, schoolId, academicYear, term,
            firstTest: r.firstTest ?? null,
            secondTest: r.secondTest ?? null,
            exam: r.exam ?? null,
            total, grade,
            createdById: userId,
            createdByRole: role,
          },
          update: {
            firstTest: r.firstTest ?? null,
            secondTest: r.secondTest ?? null,
            exam: r.exam ?? null,
            total, grade,
            createdById: userId,
            createdByRole: role,
          }
        })
      })
    )

    const uniqueStudentIds = [...new Set(results.map((entry) => entry.studentId))]
    for (const studentId of uniqueStudentIds) {
      await ensureStudentTermReport({ studentId, classId, schoolId, academicYear, term })
    }

    return reply.status(201).send({
      message: `${savedResults.length} results saved successfully`,
      count: savedResults.length
    })
  } catch (error: any) {
    console.error('Batch results error:', error)
    return reply.status(500).send({ error: 'Failed to save results' })
  }
}

// ═══════════════════════════════════════════════
// PUT /api/results/:id
// Update a single result
// ═══════════════════════════════════════════════
export const updateResult = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, role, schoolId } = await request.jwtVerify<{ id: string; role: string; schoolId: string }>()
    const { id } = request.params as { id: string }

    const existing = await prisma.result.findFirst({
      where: { id, schoolId }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Result not found' })
    }

    const scope = await assertWritableResultScope({
      userId,
      role,
      schoolId,
      studentId: existing.studentId,
      subjectId: existing.subjectId,
      classId: existing.classId
    })
    if (!scope.ok) {
      return reply.status(scope.status).send({ error: scope.error })
    }

    const body = request.body as any
    const ft = body.firstTest ?? existing.firstTest ?? 0
    const st = body.secondTest ?? existing.secondTest ?? 0
    const ex = body.exam ?? existing.exam ?? 0
    const total = ft + st + ex
    const grade = calculateGrade(total)

    const updated = await prisma.result.update({
      where: { id },
      data: {
        firstTest: body.firstTest ?? existing.firstTest,
        secondTest: body.secondTest ?? existing.secondTest,
        exam: body.exam ?? existing.exam,
        total, grade,
        createdById: userId,
        createdByRole: role,
      }
    })

    await ensureStudentTermReport({
      studentId: existing.studentId,
      classId: existing.classId,
      schoolId,
      academicYear: existing.academicYear,
      term: existing.term
    })

    return reply.send({ message: 'Result updated', result: updated })
  } catch (error: any) {
    console.error('Update result error:', error)
    return reply.status(500).send({ error: 'Failed to update result' })
  }
}
