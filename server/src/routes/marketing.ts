import { FastifyInstance } from 'fastify'
import { getPublicPricing, submitContactMessage } from '../controllers/marketing.js'

export default async function marketingRoutes(fastify: FastifyInstance) {
  fastify.get('/pricing', getPublicPricing)
  fastify.post('/contact', submitContactMessage)
}
