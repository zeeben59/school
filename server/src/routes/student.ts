import { FastifyInstance } from 'fastify'
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/student.js'

export default async function studentRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
        return reply.status(403).send({ error: 'Unauthorized to manage students' })
      }
    } catch (err) {
      return reply.send(err)
    }
  })

  fastify.get('/', getStudents)
  fastify.post('/', createStudent)
  fastify.put('/:id', updateStudent)
  fastify.delete('/:id', deleteStudent)
}
