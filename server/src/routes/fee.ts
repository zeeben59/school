import { FastifyInstance } from 'fastify'
import {
  getFees,
  createFee,
  updateFee,
  deleteFee,
} from '../controllers/fee.js'

export default async function feeRoutes(fastify: FastifyInstance) {
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

  fastify.get('/', getFees)
  fastify.post('/', createFee)
  fastify.patch('/:id', updateFee)
  fastify.delete('/:id', deleteFee)
}
