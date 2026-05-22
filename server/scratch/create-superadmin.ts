import bcrypt from 'bcrypt'
import prisma from '../src/db/prisma.js'

async function main() {
  const email = 'admin@nexdu.com'
  const password = 'ADMIN123##'
  const firstName = 'Platform'
  const lastName = 'Admin'

  const school = await prisma.school.upsert({
    where: { subdomain: 'platform-admin' },
    update: { name: 'Platform Admin', status: 'ACTIVE' },
    create: {
      name: 'Platform Admin',
      subdomain: 'platform-admin',
      status: 'ACTIVE',
    },
  })

  const hashedPassword = await bcrypt.hash(password, 10)

  const existing = await prisma.user.findFirst({
    where: { email, schoolId: school.id },
    select: { id: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        role: 'SUPERADMIN',
        firstName,
        lastName,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
      } as any,
    })
    console.log(`Updated existing user ${email} as SUPERADMIN`)
    return
  }

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      schoolId: school.id,
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    } as any,
  })

  console.log(`Created SUPERADMIN user ${email}`)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
