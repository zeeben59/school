import { FastifyInstance } from 'fastify'
import {
  getNotices,
  createNotice,
  deleteNotice,
} from '../controllers/notice.js'

export default async function noticeRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.send(err)
    }
  })

  fastify.get('/', getNotices)
  fastify.post('/', createNotice)
  fastify.delete('/:id', deleteNotice)
}
