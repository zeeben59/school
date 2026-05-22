import { FastifyInstance } from 'fastify'
import {
  getTeacherDashboard,
  getMyClasses,
  getMySubjects,
  getMyStudents,
  teacherCreateStudent,
  teacherEnrollStudent,
  getAvailableStudentsForEnrollment,
} from '../controllers/teacher-dashboard.js'

export default async function teacherDashboardRoutes(fastify: FastifyInstance) {
  // All teacher routes require JWT + TEACHER role
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'TEACHER') {
        return reply.status(403).send({ error: 'Teacher access required' })
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.get('/dashboard', getTeacherDashboard)
  fastify.get('/my-classes', getMyClasses)
  fastify.get('/my-subjects', getMySubjects)
  fastify.get('/my-students', getMyStudents)
  fastify.get('/available-students', getAvailableStudentsForEnrollment)
  fastify.post('/students', teacherCreateStudent)
  fastify.post('/enroll', teacherEnrollStudent)
}
