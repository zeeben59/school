import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import { getUploadsDirectory } from '../utils/upload-paths.js'
import { emitAdminSchoolsUpdated } from './admin.js'

const UPLOADS_DIR = getUploadsDirectory()
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_LOGO_MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
}

async function saveLogoWithSizeLimit(input: NodeJS.ReadableStream, savePath: string) {
  let totalBytes = 0
  const byteCounter = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length
      if (totalBytes > MAX_LOGO_SIZE_BYTES) {
        callback(new Error('Logo file exceeds the 5MB upload limit'))
        return
      }
      callback(null, chunk)
    }
  })

  await pipeline(input, byteCounter, fs.createWriteStream(savePath))
}

const passwordUpdateSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"]
})

/**
 * GET /api/settings/school
 * Returns authenticated user's school profile details.
 */
export const getSchoolProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId, schoolId } = await request.jwtVerify<{ id: string; schoolId: string }>()

    const [user, school] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, role: true }
      }),
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, address: true, phone: true, logoUrl: true, status: true }
      })
    ])

    if (!user || !school) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    return reply.send({
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        phone: school.phone,
        logoUrl: school.logoUrl,
        status: school.status
      },
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to fetch school profile' })
  }
}

/**
 * PATCH /api/settings/password
 */
export const updatePassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId } = await request.jwtVerify<{ id: string }>()
    const { currentPassword, newPassword } = passwordUpdateSchema.parse(request.body)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return reply.status(400).send({ error: 'Incorrect current password' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false }
    })

    return reply.send({ message: 'Password updated successfully' })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: error.issues[0].message })
    }
    return reply.status(500).send({ error: error.message || 'Failed to update password' })
  }
}

/**
 * PATCH /api/settings/school
 * Handles multipart/form-data for school profile and logo upload
 */
export const updateSchoolProfile = async (request: FastifyRequest, reply: FastifyReply) => {
  let newLogoPath: string | null = null
  let logoPersisted = false

  try {
    const { id: userId, schoolId, role } = await request.jwtVerify<{ id: string, schoolId: string, role: string }>()
    
    // RBAC: Only Directors can change school profile/branding
    if (role !== 'DIRECTOR') {
      return reply.status(403).send({ error: 'Unauthorized. Only the school Director can modify institution branding.' })
    }
    
    // Check if it's multipart
    if (!request.isMultipart()) {
      return reply.status(400).send({ error: 'Request must be multipart/form-data' })
    }

    const parts = request.parts()
    let name: string | undefined
    let address: string | undefined
    let phone: string | undefined
    let directorFullName: string | undefined
    let logoUrl: string | undefined
    let logoUploadRequested = false
    let fileSaved = false
    let oldLogoPath: string | null = null

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'logo') {
          logoUploadRequested = true
          if (fileSaved) {
            await part.file.resume()
            return reply.status(400).send({ error: 'Only one logo file can be uploaded per request.' })
          }

          // Validate file type
          const extension = ALLOWED_LOGO_MIME_TO_EXT[part.mimetype]
          if (!extension) {
            await part.file.resume()
            return reply.status(400).send({ error: 'Invalid file type. Only PNG, JPG, WEBP allowed.' })
          }

          const fileName = `school_logo_${schoolId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`
          const savePath = path.join(UPLOADS_DIR, fileName)
          fs.mkdirSync(UPLOADS_DIR, { recursive: true })

          // Get current school to find old logo for deletion
          const school = await prisma.school.findUnique({ where: { id: schoolId } })
          if (school?.logoUrl && (school.logoUrl.startsWith('/uploads/') || school.logoUrl.startsWith('/api/uploads/'))) {
            oldLogoPath = path.join(UPLOADS_DIR, path.basename(school.logoUrl))
          }

          // Save new file
          await saveLogoWithSizeLimit(part.file, savePath)
          const savedStat = fs.existsSync(savePath) ? fs.statSync(savePath) : null
          if (!savedStat || savedStat.size <= 0) {
            throw new Error('Logo upload could not be persisted to disk')
          }
          logoUrl = `/api/uploads/${fileName}`
          newLogoPath = savePath
          fileSaved = true
        } else {
          await part.file.resume() // Ignore other files
        }
      } else {
        // Handle fields
        if (part.fieldname === 'name') name = part.value as string
        if (part.fieldname === 'address') address = part.value as string
        if (part.fieldname === 'phone') phone = part.value as string
        if (part.fieldname === 'directorFullName') directorFullName = part.value as string
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update School Details
      await tx.school.update({
        where: { id: schoolId },
        data: {
          ...(name && { name }),
          ...(address && { address }),
          ...(phone && { phone }),
          ...(logoUrl && { logoUrl })
        }
      })

      // 2. Update Director Details (if provided)
      if (directorFullName) {
        const nameParts = directorFullName.trim().split(' ')
        const firstName = nameParts[0]
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

        await tx.user.update({
          where: { id: userId },
          data: {
            firstName,
            lastName
          }
        })
      }
    })
    logoPersisted = Boolean(logoUrl)

    // Clean up old logo if replacement was successful
    if (fileSaved && oldLogoPath && oldLogoPath !== newLogoPath && fs.existsSync(oldLogoPath)) {
      try {
        fs.unlinkSync(oldLogoPath)
      } catch (err) {
        console.error('Failed to delete old logo:', err)
      }
    }

    // Fetch updated data
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { school: true }
    })

    const logoUploadCompleted = Boolean(
      logoUploadRequested &&
      logoUrl &&
      newLogoPath &&
      fs.existsSync(newLogoPath)
    )

    emitAdminSchoolsUpdated('school:updated')

    return reply.send({
      message: 'Profile updated successfully',
      logoUploadCompleted,
      user: {
        id: updatedUser?.id,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        school: updatedUser?.school.name,
        logoUrl: updatedUser?.school.logoUrl,
        phone: updatedUser?.school.phone,
        address: updatedUser?.school.address
      }
    })

  } catch (error: any) {
    if (!logoPersisted && newLogoPath && fs.existsSync(newLogoPath)) {
      try {
        fs.unlinkSync(newLogoPath)
      } catch (cleanupError) {
        console.error('Failed to cleanup unsaved logo file:', cleanupError)
      }
    }
    console.error('Update profile error:', error)
    const errorMessage = String(error?.message || '').toLowerCase()
    const errorCode = String(error?.code || '')
    if (
      errorCode === 'FST_REQ_FILE_TOO_LARGE' ||
      errorMessage.includes('5mb upload limit') ||
      errorMessage.includes('file too large')
    ) {
      return reply.status(400).send({ error: 'File too large. Max 5MB.' })
    }
    return reply.status(500).send({ error: 'Failed to update profile' })
  }
}

/**
 * DELETE /api/settings/self
 * Soft-delete currently authenticated user account.
 */
export const selfDeleteAccount = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id: userId } = await request.jwtVerify<{ id: string }>()

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, role: true }
    })

    if (!existing) {
      return reply.status(404).send({ error: 'User not found' })
    }

    if (existing.role === 'SUPERADMIN') {
      return reply.status(400).send({ error: 'Superadmin account cannot self-delete from this route.' })
    }

    if (existing.deletedAt) {
      return reply.send({ message: 'Account already deleted' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        deletedBy: 'self',
      }
    })

    return reply.send({ message: 'Account deleted successfully' })
  } catch (error: any) {
    return reply.status(500).send({ error: 'Failed to delete account' })
  }
}
