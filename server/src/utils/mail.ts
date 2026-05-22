import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@edunexus.local'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.SUPPORT_INBOX_EMAIL || MAIL_FROM
const SMTP_EMAIL = process.env.SMTP_EMAIL || process.env.SMTP_USER || MAIL_FROM

let transporter: any = null
let verifyPromise: Promise<void> | null = null

function hasAnySmtpConfig() {
  return Boolean(SMTP_HOST || SMTP_USER || SMTP_PASS || process.env.MAIL_FROM)
}

function hasCompleteSmtpConfig() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && process.env.MAIL_FROM)
}

export function isSmtpConfigured() {
  return hasCompleteSmtpConfig()
}

function getTransporter() {
  if (transporter) {
    return transporter
  }

  if (!hasCompleteSmtpConfig()) {
    if (hasAnySmtpConfig()) {
      throw new Error('SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.')
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP configuration is required in production')
    }

    console.warn('[mail] SMTP env not configured. Using development jsonTransport.')
    transporter = nodemailer.createTransport({
      jsonTransport: true
    })
    return transporter
  }

  console.info(`[mail] Initializing SMTP transport for ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`)
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  })

  return transporter
}

export async function verifyMailTransport() {
  const transport = getTransporter()

  if (!hasCompleteSmtpConfig()) {
    console.warn('[mail] SMTP verification skipped because SMTP env is not configured.')
    return
  }

  if (!verifyPromise) {
    verifyPromise = transport.verify()
      .then(() => {
        console.info(`[mail] SMTP connection verified successfully for ${SMTP_USER}`)
      })
      .catch((error: any) => {
        verifyPromise = null
        console.error('[mail] SMTP connection verification failed:', error)
        throw error
      })
  }

  await verifyPromise
}

export async function sendRegistrationOtpEmail(params: {
  email: string
  otpCode: string
  firstName: string
  schoolName: string
  expiresInMinutes: number
}) {
  const transport = getTransporter()

  if (hasCompleteSmtpConfig()) {
    await verifyMailTransport()
  }

  const info = await transport.sendMail({
    from: MAIL_FROM,
    to: params.email,
    subject: 'Verify Your School Registration',
    text: [
      `Hello ${params.firstName},`,
      '',
      `Your OTP code for ${params.schoolName} is ${params.otpCode}.`,
      `This code expires in ${params.expiresInMinutes} minutes.`,
      '',
      'If you did not start this registration, please ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px">
          <p style="margin:0 0 12px;font-size:14px;color:#475569">EduNexus Pro</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Verify Your School Registration</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hello ${params.firstName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6">
            Use the OTP below to continue the registration for <strong>${params.schoolName}</strong>.
          </p>
          <div style="margin:0 0 20px;padding:18px;border-radius:16px;background:#0f172a;color:#ffffff;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px">
            ${params.otpCode}
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569">
            This code expires in <strong>${params.expiresInMinutes} minutes</strong>.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569">
            If you did not start this registration, you can safely ignore this email.
          </p>
        </div>
      </div>
    `
  })

  console.info(`[mail] Registration OTP email sent to ${params.email}. messageId=${info.messageId || 'n/a'}`)
  return info
}

export async function sendPasswordResetEmail(params: {
  email: string
  firstName: string
  resetUrl: string
  expiresInMinutes: number
}) {
  const transport = getTransporter()

  if (hasCompleteSmtpConfig()) {
    await verifyMailTransport()
  }

  const info = await transport.sendMail({
    from: MAIL_FROM,
    to: params.email,
    subject: 'Reset Your EduNexus Password',
    text: [
      `Hello ${params.firstName},`,
      '',
      'We received a request to reset your password.',
      `Use this link to continue: ${params.resetUrl}`,
      `This link expires in ${params.expiresInMinutes} minutes.`,
      '',
      'If you did not request this change, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc;color:#0f172a">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px">
          <p style="margin:0 0 12px;font-size:14px;color:#475569">EduNexus Pro</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">Reset Your Password</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hello ${params.firstName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6">
            Click the button below to set a new password for your account.
          </p>
          <a href="${params.resetUrl}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700">
            Reset Password
          </a>
          <p style="margin:20px 0 10px;font-size:14px;line-height:1.6;color:#475569">
            This link expires in <strong>${params.expiresInMinutes} minutes</strong>.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#475569">
            If you did not request this change, you can ignore this email.
          </p>
        </div>
      </div>
    `
  })

  console.info(`[mail] Password reset email sent to ${params.email}. messageId=${info.messageId || 'n/a'}`)
  return info
}

export async function sendSupportNotificationEmail(params: {
  type: 'FEEDBACK' | 'SUPPORT_THREAD' | 'SUPPORT_MESSAGE'
  schoolId: string
  schoolName?: string | null
  userId: string
  userEmail?: string | null
  userName?: string | null
  role: string
  category?: string | null
  subject?: string | null
  message: string
  createdAt: Date
}) {
  const transport = getTransporter()

  if (hasCompleteSmtpConfig()) {
    await verifyMailTransport()
  }

  const schoolLabel = params.schoolName?.trim() || params.schoolId
  const userLabel = params.userName?.trim() || params.userEmail?.trim() || params.userId

  const info = await transport.sendMail({
    from: MAIL_FROM,
    to: SUPPORT_EMAIL,
    subject: `[${params.type}] ${params.subject || params.category || 'Support Notification'} - ${schoolLabel}`,
    text: [
      `Type: ${params.type}`,
      `School: ${schoolLabel} (${params.schoolId})`,
      `Sender: ${userLabel}`,
      `Sender Role: ${params.role}`,
      `Sender Email: ${params.userEmail || 'n/a'}`,
      `Category: ${params.category || 'n/a'}`,
      `Subject: ${params.subject || 'n/a'}`,
      `Submitted At: ${params.createdAt.toISOString()}`,
      '',
      'Message:',
      params.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f8fafc;color:#0f172a">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
          <h2 style="margin:0 0 12px;font-size:18px">Support Notification</h2>
          <p style="margin:0 0 8px"><strong>Type:</strong> ${params.type}</p>
          <p style="margin:0 0 8px"><strong>School:</strong> ${schoolLabel} (${params.schoolId})</p>
          <p style="margin:0 0 8px"><strong>Sender:</strong> ${userLabel}</p>
          <p style="margin:0 0 8px"><strong>Sender Role:</strong> ${params.role}</p>
          <p style="margin:0 0 8px"><strong>Sender Email:</strong> ${params.userEmail || 'n/a'}</p>
          <p style="margin:0 0 8px"><strong>Category:</strong> ${params.category || 'n/a'}</p>
          <p style="margin:0 0 8px"><strong>Subject:</strong> ${params.subject || 'n/a'}</p>
          <p style="margin:0 0 12px"><strong>Submitted At:</strong> ${params.createdAt.toISOString()}</p>
          <div style="padding:12px;border-radius:10px;background:#f1f5f9;white-space:pre-wrap">${params.message}</div>
        </div>
      </div>
    `,
  })

  console.info(`[mail] Support notification sent to ${SUPPORT_EMAIL}. messageId=${info.messageId || 'n/a'}`)
  return info
}

export async function sendContactFormEmail(params: {
  name: string
  email: string
  message: string
}) {
  if (!SMTP_EMAIL || !SMTP_PASS) {
    throw new Error('SMTP_EMAIL (or SMTP_USER) and SMTP_PASS are required for contact form delivery.')
  }

  const gmailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASS,
    },
  })

  const info = await gmailTransport.sendMail({
    from: SMTP_EMAIL,
    to: SMTP_EMAIL,
    replyTo: params.email,
    subject: `New Contact Form Message from ${params.name}`,
    text: [
      'New contact form submission:',
      '',
      `Name: ${params.name}`,
      `Email: ${params.email}`,
      '',
      'Message:',
      params.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f8fafc;color:#0f172a">
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:20px">
          <h2 style="margin:0 0 14px;font-size:20px">New Contact Form Submission</h2>
          <p style="margin:0 0 8px"><strong>Name:</strong> ${params.name}</p>
          <p style="margin:0 0 8px"><strong>Email:</strong> ${params.email}</p>
          <p style="margin:12px 0 8px"><strong>Message:</strong></p>
          <div style="padding:12px;border-radius:10px;background:#f1f5f9;white-space:pre-wrap">${params.message}</div>
        </div>
      </div>
    `,
  })

  console.info(`[mail] Contact form email sent to ${SMTP_EMAIL}. messageId=${info.messageId || 'n/a'}`)
  return info
}
