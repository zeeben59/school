import { FastifyInstance } from 'fastify'
import {
  getTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacher.js'

export default async function teacherRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
        return reply.status(403).send({ error: 'Unauthorized to manage teachers' })
      }
    } catch (err) {
      return reply.send(err)
    }
  })

  fastify.get('/', getTeachers)
  fastify.post('/', createTeacher)
  fastify.put('/:id', updateTeacher)
  fastify.delete('/:id', deleteTeacher)
}
