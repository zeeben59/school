import { FastifyRequest, FastifyReply } from 'fastify'
import { basename, resolve } from 'path'
import fs from 'fs'
import { getResultDocumentsDirectory, getUploadsDirectory } from '../utils/upload-paths.js'
import prisma from '../db/prisma.js'

const UPLOADS_DIR = getUploadsDirectory()
const RESULT_DOCUMENTS_DIR = getResultDocumentsDirectory()

function resolveSafePath(baseDir: string, fileName: string) {
  const resolvedBase = resolve(baseDir)
  const resolvedPath = resolve(baseDir, fileName)
  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}\\`) && !resolvedPath.startsWith(`${resolvedBase}/`)) {
    return null
  }
  return resolvedPath
}

export const getProtectedFile = async (request: FastifyRequest, reply: FastifyReply) => {
  const { filename } = request.params as { filename: string }
  const schoolId = request.schoolId
  const authUser = (request as any).user as { id?: string; role?: string; schoolId?: string } | undefined

  const normalizedName = filename?.trim() || ''
  const safeName = normalizedName === '' ? '' : normalizedName.split(/[\\/]/).pop() || ''

  if (safeName !== normalizedName || safeName.includes('..')) {
    return reply.status(400).send({ error: 'Invalid filename' })
  }

  const school = await prisma.school.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { logoUrl: `/api/uploads/${safeName}` },
        { logoUrl: `/uploads/${safeName}` }
      ]
    },
    select: { id: true, logoUrl: true }
  })

  if (school) {
    if (schoolId && school.id !== schoolId) {
      return reply.status(403).send({ error: 'Access denied: Asset belongs to another tenant' })
    }

    const logoFileName = basename(school.logoUrl || safeName)
    const filePath = resolveSafePath(UPLOADS_DIR, logoFileName)
    if (!filePath || !fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Asset not found' })
    }

    const stream = fs.createReadStream(filePath)
    return reply.type(getFileMimeType(logoFileName)).send(stream)
  }

  if (!schoolId || !authUser?.id || !authUser.role) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  const document = await (prisma as any).resultDocument.findFirst({
    where: {
      schoolId,
      OR: [
        { fileUrl: `/api/uploads/${safeName}` },
        { fileUrl: `/uploads/${safeName}` },
        { fileUrl: `/uploads/result-documents/${safeName}` }
      ]
    },
    select: {
      id: true,
      filePath: true,
      originalFileName: true,
      student: { select: { userId: true } },
      subject: { select: { teacher: { select: { userId: true } } } }
    }
  })

  if (!document) {
    return reply.status(404).send({ error: 'Asset not found' })
  }

  if (authUser.role === 'STUDENT' && document.student.userId !== authUser.id) {
    return reply.status(403).send({ error: 'Access denied: You can only access your own result files' })
  }

  if (authUser.role === 'TEACHER' && document.subject.teacher?.userId !== authUser.id) {
    return reply.status(403).send({ error: 'Access denied: You can only access files for your assigned subjects' })
  }

  if (authUser.role !== 'DIRECTOR' && authUser.role !== 'PRINCIPAL' && authUser.role !== 'TEACHER' && authUser.role !== 'STUDENT') {
    return reply.status(403).send({ error: 'Access denied' })
  }

  const expectedPath = resolveSafePath(RESULT_DOCUMENTS_DIR, safeName)
  const storedPath = resolve(document.filePath || '')
  if (!document.filePath || !expectedPath || storedPath !== expectedPath) {
    return reply.status(403).send({ error: 'Access denied' })
  }

  if (!fs.existsSync(storedPath)) {
    return reply.status(404).send({ error: 'Asset not found' })
  }

  // Stream the file back
  const mimeSource = document.originalFileName || safeName
  const stream = fs.createReadStream(storedPath)
  return reply.type(getFileMimeType(mimeSource)).send(stream)
}

function getFileMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'png': return 'image/png'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'pdf': return 'application/pdf'
    default: return 'application/octet-stream'
  }
}
