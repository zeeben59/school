import { FastifyInstance } from 'fastify'
import {
  aiHelp,
  createAssistantReply,
  createSupportThread,
  getSupportThreadMessages,
  listFeedback,
  listSupportThreads,
  postSupportMessage,
  submitFeedback,
  updateFeedbackStatus,
} from '../controllers/support.js'

export default async function supportRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (_err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.post('/feedback', submitFeedback)
  fastify.get('/feedback', listFeedback)
  fastify.patch('/feedback/:id/status', updateFeedbackStatus)

  fastify.post('/threads', createSupportThread)
  fastify.get('/threads', listSupportThreads)
  fastify.get('/threads/:id/messages', getSupportThreadMessages)
  fastify.post('/threads/:id/messages', postSupportMessage)
  fastify.post('/threads/:id/assistant-reply', createAssistantReply)
  fastify.post('/ai-help', aiHelp)
}
