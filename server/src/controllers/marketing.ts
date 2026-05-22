import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../db/prisma.js'
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getAllTermPricesNaira, SCHOOL_TRIAL_DAYS, SUBSCRIPTION_TERM_OPTIONS } from '../utils/subscription.js'
import { sendContactFormEmail } from '../utils/mail.js'

export const getPublicPricing = async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.send({
    trialDays: SCHOOL_TRIAL_DAYS,
    currency: 'NGN',
    terms: SUBSCRIPTION_TERM_OPTIONS.map((termName) => ({
      termName,
      amount: getAllTermPricesNaira()[termName],
    })),
  })
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(10).max(3000),
})

export const submitContactMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const parsed = contactSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid contact form input',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const data = parsed.data
    const schoolId = request.schoolId || request.schoolHint || null

    try {
      await sendContactFormEmail({
        name: data.name,
        email: data.email,
        message: data.message,
      })
    } catch (mailError) {
      request.log.error({ err: mailError }, 'Contact email delivery failed')
      return reply.status(502).send({
        success: false,
        error: 'Unable to send contact email right now. Please try again shortly.',
      })
    }

    try {
      const record = await prisma.contactMessage.create({
        data: {
          name: data.name,
          email: data.email,
          message: data.message,
          schoolId,
        },
        select: {
          id: true,
          createdAt: true,
        },
      })

      return reply.status(201).send({
        success: true,
        message: 'Message sent successfully',
        contactId: record.id,
        createdAt: record.createdAt,
      })
    } catch (dbError) {
      request.log.warn({ err: dbError }, 'Contact DB write failed; falling back to local queue file')
      const queueDir = path.resolve(process.cwd(), 'data')
      const queueFile = path.join(queueDir, 'contact-messages.ndjson')
      await mkdir(queueDir, { recursive: true })
      await appendFile(
        queueFile,
        JSON.stringify({
          name: data.name,
          email: data.email,
          message: data.message,
          schoolId,
          createdAt: new Date().toISOString(),
        }) + '\n',
        'utf8'
      )

      return reply.status(201).send({
        success: true,
        message: 'Message sent successfully',
      })
    }
  } catch (error) {
    request.log.error({ err: error }, 'Failed to save contact message')
    return reply.status(500).send({ error: 'Failed to send message' })
  }
}
