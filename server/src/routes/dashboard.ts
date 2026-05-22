import { FastifyInstance } from 'fastify'
import { getDashboardSummary } from '../controllers/dashboard.js'

export default async function dashboardRoutes(fastify: FastifyInstance) {
  // All dashboard routes require authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized — please log in' })
    }
  })

  fastify.get('/summary', getDashboardSummary)
}
