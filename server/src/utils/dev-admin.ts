import bcrypt from 'bcrypt'
import prisma from '../db/prisma.js'

const DEV_ADMIN_SUBDOMAIN = 'platform-admin'

export async function ensureLocalPlatformAdmin() {
  const bootstrapEnabled = process.env.BOOTSTRAP_PLATFORM_ADMIN !== 'false'
  if (!bootstrapEnabled) {
    return
  }

  const adminEmail = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase()
  const adminPassword = process.env.SUPERADMIN_PASSWORD || ''

  if (!adminEmail || !adminPassword) {
    return
  }

  if (adminPassword.length < 12) {
    throw new Error('SUPERADMIN_PASSWORD must be at least 12 characters')
  }

  const school = await prisma.school.upsert({
    where: { subdomain: DEV_ADMIN_SUBDOMAIN },
    update: { name: 'Platform Admin', status: 'ACTIVE' },
    create: {
      name: 'Platform Admin',
      subdomain: DEV_ADMIN_SUBDOMAIN,
      status: 'ACTIVE',
    },
  })

  const existing = await prisma.user.findFirst({
    where: {
      email: adminEmail,
      schoolId: school.id,
    },
    select: { id: true },
  })

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: 'SUPERADMIN',
        status: 'ACTIVE',
        password: hashedPassword,
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
      } as any,
    })
    return
  }

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      schoolId: school.id,
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    } as any,
  })
}
