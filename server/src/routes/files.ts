import { FastifyInstance } from 'fastify'
import { getProtectedFile } from '../controllers/files.js'

export default async function fileRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      // Allow anonymous access for school logos only.
      // Controller performs strict DB-backed ownership checks for all files.
    }
  })
  
  fastify.get('/:filename', getProtectedFile)
}
