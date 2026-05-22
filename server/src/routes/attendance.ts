import { FastifyInstance } from 'fastify'
import {
  getAttendance,
  markAttendance,
  bulkMarkAttendance,
  getAttendanceStats,
} from '../controllers/attendance.js'

export default async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (_err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.get('/', getAttendance)
  fastify.get('/stats', getAttendanceStats)
  fastify.post('/', markAttendance)
  fastify.post('/bulk', bulkMarkAttendance)
}
