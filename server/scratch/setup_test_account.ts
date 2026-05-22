import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const email = 'test_director@school.com'
  const password = 'Password123!'
  const hashedPassword = await bcrypt.hash(password, 10)

  // 1. Create School
  const school = await prisma.school.upsert({
    where: { email: 'test_school@school.com' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Test Academy',
      email: 'test_school@school.com',
      phone: '1234567890',
      address: '123 Test St',
      status: 'ACTIVE'
    }
  })

  // 2. Create User (Director)
  const user = await prisma.user.upsert({
    where: { email },
    update: { 
      password: hashedPassword,
      status: 'ACTIVE',
      role: 'DIRECTOR'
    },
    create: {
      email,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Director',
      role: 'DIRECTOR',
      schoolId: school.id,
      status: 'ACTIVE'
    }
  })

  console.log(`Director created/updated: ${email} / Password123!`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
