import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
    if (student) {
        console.log('Found student:', student.id)
        await prisma.user.delete({ where: { id: student.id } })
        console.log('Deleted successfully')
    } else {
        console.log('No student found')
    }
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

test()
