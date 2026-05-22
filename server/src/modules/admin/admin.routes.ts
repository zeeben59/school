import { FastifyInstance } from 'fastify'
import {
  createAdminStreamToken,
  getAdminActivityHealth,
  getAdminAnalytics,
  getAdminOverview,
  getAdminSchoolDetails,
  getAdminSubscriptions,
  listAdminDeletedUsers,
  listAdminUsers,
  listAdminSchools,
  restoreAdminUser,
  listAdminSupport,
  softDeleteAdminUser,
  streamAdminEvents,
  updateAdminSubscriptionStatus,
  updateAdminFeedbackStatus,
  updateAdminSupportThreadStatus,
  cleanupStaleSubscriptions,
} from './admin.controller.js'

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    const path = String(request.url || '').split('?')[0]
    if (request.method === 'GET' && (path === '/stream' || path.endsWith('/stream'))) {
      return
    }

    // Allow tenant middleware to have populated `request.user` (Supabase token)
    const existingUser = (request as any).user
    if (existingUser) {
      if (existingUser.role !== 'SUPERADMIN') {
        return reply.status(403).send({ error: 'Forbidden: Platform admin access only' })
      }
      return
    }

    // Fallback to JWT verification
    try {
      const decoded = await request.jwtVerify<{ role: string }>()
      if (decoded.role !== 'SUPERADMIN') {
        return reply.status(403).send({ error: 'Forbidden: Platform admin access only' })
      }
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  fastify.get('/overview', getAdminOverview)
  fastify.post('/stream-token', createAdminStreamToken)
  fastify.get('/stream', streamAdminEvents)
  fastify.get('/schools', listAdminSchools)
  fastify.get('/schools/:id', getAdminSchoolDetails)
  fastify.get('/subscriptions', getAdminSubscriptions)
  fastify.delete('/subscriptions/stale', cleanupStaleSubscriptions)
  fastify.patch('/subscriptions/:id/status', updateAdminSubscriptionStatus)
  fastify.get('/users', listAdminUsers)
  fastify.get('/users/trash', listAdminDeletedUsers)
  fastify.patch('/users/:id/restore', restoreAdminUser)
  fastify.delete('/users/:id', softDeleteAdminUser)
  fastify.get('/support', listAdminSupport)
  fastify.patch('/support/feedback/:id/status', updateAdminFeedbackStatus)
  fastify.patch('/support/threads/:id/status', updateAdminSupportThreadStatus)
  fastify.get('/activity', getAdminActivityHealth)
  fastify.get('/analytics', getAdminAnalytics)
}
