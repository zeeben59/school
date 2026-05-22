import { FastifyInstance } from 'fastify'
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead 
} from '../controllers/notification.js'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.get('/', getNotifications)
  fastify.patch('/:id/read', markAsRead)
  fastify.patch('/read-all', markAllAsRead)
}
