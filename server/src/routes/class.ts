import { FastifyInstance } from 'fastify'
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} from '../controllers/class.js'

export default async function classRoutes(fastify: FastifyInstance) {
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

  fastify.get('/', getClasses)
  fastify.post('/', createClass)
  fastify.put('/:id', updateClass)
  fastify.delete('/:id', deleteClass)
}
