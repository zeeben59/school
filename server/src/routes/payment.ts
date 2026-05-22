import { FastifyInstance } from 'fastify'
import {
  verifyPayment,
  reinitializePayment,
  getSubscriptionStatus,
  initializeSubscriptionPayment,
} from '../controllers/payment.js'

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.get('/verify/:reference', verifyPayment)
  fastify.post('/reinitialize', reinitializePayment)
  fastify.get('/subscription/status', getSubscriptionStatus)
  fastify.post('/subscription/initialize', initializeSubscriptionPayment)
}
