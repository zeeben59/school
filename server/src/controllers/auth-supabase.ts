import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin, supabaseAuth } from '../lib/supabase.js'

const normalizedEmailSchema = z.string().trim().toLowerCase().email()

const registerSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(8),
  schoolName: z.string().min(3),
  directorFullName: z.string().min(3),
  phone: z.string().optional(),
  address: z.string().optional(),
})

const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1)
})

function splitFullName(fullName: string) {
  const nameParts = fullName.trim().split(' ').filter(Boolean)
  return {
    firstName: nameParts[0] || 'Director',
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(' ') : '',
  }
}

function mapProfileToAppUser(user: any, profile: any) {
  const role = profile?.role || user?.user_metadata?.role || 'DIRECTOR'
  const schoolId = profile?.school_id || profile?.schoolId || user?.user_metadata?.school_id || user?.user_metadata?.schoolId || ''
  const schoolName = profile?.school_name || profile?.schoolName || user?.user_metadata?.school_name || user?.user_metadata?.schoolName || 'School'

  return {
    id: user.id,
    email: user.email,
    firstName: profile?.first_name || profile?.firstName || user?.user_metadata?.firstName || 'Director',
    lastName: profile?.last_name || profile?.lastName || user?.user_metadata?.lastName || '',
    role,
    school: schoolName,
    schoolId,
    status: profile?.status || 'ACTIVE',
    logoUrl: profile?.logo_url || '',
    address: profile?.address || '',
    phone: profile?.phone || '',
    emailVerifiedAt: user?.email_confirmed_at || null,
    mustChangePassword: false,
    hasActiveSubscription: true,
    accessState: 'ACTIVE',
  }
}

export const register = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = registerSchema.parse(request.body)
    const { firstName, lastName } = splitFullName(body.directorFullName)

    const { data, error } = await supabaseAuth.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          firstName,
          lastName,
          role: 'DIRECTOR',
          schoolName: body.schoolName,
        },
      },
    } as any)

    let user = data?.user || null
    if (error || !user) {
      const adminResp: any = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          role: 'DIRECTOR',
          schoolName: body.schoolName,
          phone: body.phone || '',
          address: body.address || '',
        },
      } as any)

      if (adminResp?.error) {
        return reply.status(400).send({ error: adminResp.error.message || 'Failed to create user' })
      }

      user = adminResp?.data?.user || adminResp?.user || null
    }

    if (!user) {
      return reply.status(400).send({ error: 'Failed to register user' })
    }

    const profilePayload = {
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      role: 'DIRECTOR',
      school_name: body.schoolName,
      phone: body.phone || '',
      address: body.address || '',
      status: 'ACTIVE',
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert(profilePayload as any)
    if (profileError) {
      request.log.warn({ err: profileError }, 'Failed to insert profile row in Supabase')
    }

    return reply.status(201).send({
      message: 'Registration successful. You can now login.',
      email: body.email,
      verificationRequired: false,
    })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: err.issues[0]?.message || 'Invalid input' })
    }
    request.log.error({ err }, 'Registration failed')
    return reply.status(500).send({ error: 'Registration failed' })
  }
}

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { email, password } = loginSchema.parse(request.body)

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password } as any)

    if (error) {
      request.log.warn({ email, err: error }, 'Supabase signIn failed')
      return reply.status(401).send({ error: error.message || 'Invalid credentials' })
    }

    const session = data.session
    const user = data.user

    if (!session || !user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const { data: profileData } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle()
    const appUser = mapProfileToAppUser(user, profileData)

    return reply.send({ token: session.access_token, user: appUser })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: err.issues[0]?.message || 'Invalid input' })
    }
    request.log.error({ err }, 'Login failed')
    return reply.status(500).send({ error: 'Failed to sign in' })
  }
}

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization || ''
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return reply.status(401).send({ error: 'Unauthorized' })

    const { data, error } = await supabaseAuth.auth.getUser(token as any)
    if (error) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const user = data.user
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const { data: profileData } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle()
    return reply.send(mapProfileToAppUser(user, profileData))
  } catch (err: any) {
    request.log.error({ err }, 'getMe failed')
    return reply.status(500).send({ error: 'Failed to refresh session' })
  }
}
