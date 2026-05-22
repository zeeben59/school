import { FastifyInstance } from 'fastify'
import {
  getSchoolProfile,
  selfDeleteAccount,
  updatePassword,
  updateSchoolProfile
} from '../controllers/settings.js'

export default async function settingsRoutes(fastify: FastifyInstance) {
  // All settings routes require authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (_err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.get('/school', getSchoolProfile)
  // Backward-compatible alias used by older clients.
  fastify.get('/profile', getSchoolProfile)
  fastify.patch('/password', updatePassword)
  fastify.patch('/school', updateSchoolProfile)
  // Backward-compatible alias used by older clients.
  fastify.patch('/profile', updateSchoolProfile)
  fastify.delete('/self', selfDeleteAccount)
}
