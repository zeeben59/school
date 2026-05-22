import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCompleteDelete() {
  try {
    const school = await prisma.school.findFirst()
    if (!school) return console.log('No school')

    const student = await prisma.user.create({
      data: {
        firstName: 'Test', lastName: 'Delete', email: 'testdelete1@test.com', password: '123', role: 'STUDENT', schoolId: school.id,
        studentProfile: { create: { schoolId: school.id, admissionNo: 'TD001' } }
      }
    })

    const cls = await prisma.class.findFirst()
    if (cls) {
      const studentProfile = await prisma.student.findUnique({ where: { userId: student.id } })
      await prisma.enrollment.create({
        data: { studentId: studentProfile!.id, classId: cls.id, academicYear: '2024' }
      })
    }

    await prisma.attendance.create({
      data: { date: new Date(), status: 'PRESENT', userId: student.id, markedById: student.id, schoolId: school.id }
    })

    console.log('Created student with relations:', student.id)
    
    await prisma.user.delete({ where: { id: student.id } })
    console.log('Deleted successfully!')
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

testCompleteDelete()
