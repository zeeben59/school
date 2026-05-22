import { FastifyInstance } from 'fastify'
import {
  getPrincipals,
  createPrincipal,
  updatePrincipal,
  deletePrincipal,
} from '../controllers/principal.js'

export default async function principalRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'DIRECTOR') {
        return reply.status(403).send({ error: 'Only Directors can manage principals' })
      }
    } catch (err) {
      return reply.send(err)
    }
  })

  fastify.get('/', getPrincipals)
  fastify.post('/', createPrincipal)
  fastify.put('/:id', updatePrincipal)
  fastify.delete('/:id', deletePrincipal)
}
