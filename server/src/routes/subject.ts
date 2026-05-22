import { FastifyInstance } from 'fastify'
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subject.js'

export default async function subjectRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
        return reply.status(403).send({ error: 'Unauthorized' })
      }
    } catch (err) {
      return reply.send(err)
    }
  })

  fastify.get('/', getSubjects)
  fastify.post('/', createSubject)
  fastify.put('/:id', updateSubject)
  fastify.delete('/:id', deleteSubject)
}
