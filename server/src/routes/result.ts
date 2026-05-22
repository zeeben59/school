import { FastifyInstance } from 'fastify'
import {
  getResults,
  getResultSlip,
  createResult,
  batchCreateResults,
  updateResult,
  listResultDocuments,
  uploadResultDocument,
  getResultDocumentFile,
} from '../controllers/result.js'

export default async function resultRoutes(fastify: FastifyInstance) {
  const requireResultRead = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'TEACHER' && role !== 'DIRECTOR' && role !== 'PRINCIPAL' && role !== 'STUDENT') {
        return reply.status(403).send({ error: 'Unauthorized to access results' })
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  const requireResultWrite = async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
      const { role } = request.user as { role: string }
      if (role !== 'TEACHER' && role !== 'DIRECTOR' && role !== 'PRINCIPAL') {
        return reply.status(403).send({ error: 'Unauthorized to modify results' })
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  }

  fastify.get('/', { onRequest: requireResultRead }, getResults)
  fastify.get('/report-slip', { onRequest: requireResultRead }, getResultSlip)
  fastify.get('/documents', { onRequest: requireResultRead }, listResultDocuments)
  fastify.get('/documents/:id/file', { onRequest: requireResultRead }, getResultDocumentFile)
  fastify.post('/documents/upload', { onRequest: requireResultWrite }, uploadResultDocument)
  fastify.post('/', { onRequest: requireResultWrite }, createResult)
  fastify.post('/batch', { onRequest: requireResultWrite }, batchCreateResults)
  fastify.put('/:id', { onRequest: requireResultWrite }, updateResult)
}
