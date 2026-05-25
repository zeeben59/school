import { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../lib/supabase.js'

export const tenantMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const headerValue = request.headers['x-school-id']
  const schoolHint = typeof headerValue === 'string' ? headerValue.trim() : ''
  if (schoolHint) {
    request.schoolHint = schoolHint
  }

  let authenticatedSchoolId: string | null = null
  let resolvedAuthUser: { id: string; role: string; schoolId: string | null } | null = null

  // Tenant authority — try Fastify JWT first, fallback to Supabase token if present.
  try {
    if (request.headers.authorization) {
      try {
        const decoded = await request.jwtVerify<{ id: string; schoolId: string; role: string }>()
        if (decoded) {
          resolvedAuthUser = {
            id: decoded.id,
            role: decoded.role,
            schoolId: decoded.schoolId ?? null,
          }
          ;(request as any).user = resolvedAuthUser
          authenticatedSchoolId = decoded.schoolId
        }
      } catch {
        // JWT verification failed — try Supabase token as fallback (access token)
        try {
          const authHeader = request.headers.authorization as string
          const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
          const { data, error } = await supabaseAdmin.auth.getUser(token as any)
          if (!error && data?.user) {
            const user = data.user
            // attempt to load profile for role/school context
            const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle()
            resolvedAuthUser = {
              id: user.id,
              role: profile?.role || user.user_metadata?.role || 'USER',
              schoolId:
                profile?.school_id || profile?.schoolId || user.user_metadata?.school_id || user.user_metadata?.schoolId || null,
            }
            ;(request as any).user = resolvedAuthUser
            authenticatedSchoolId = (request as any).user.schoolId
          }
        } catch {
          authenticatedSchoolId = null
        }
      }
    }
  } catch {
    authenticatedSchoolId = null
  }

  if (resolvedAuthUser) {
    ;(request as any).jwtVerify = async () => resolvedAuthUser as any
  }

  if (authenticatedSchoolId) {
    request.schoolId = authenticatedSchoolId
    if (schoolHint && schoolHint !== authenticatedSchoolId) {
      request.log.warn({
        route: request.url,
      }, 'Ignoring x-school-id because it conflicts with authenticated tenant context')
    }
  } else if (schoolHint && request.headers.authorization) {
    request.log.warn({
      route: request.url,
    }, 'Ignoring x-school-id because no authenticated tenant context is available')
  }
}

// Helper to decorate request type in Fastify
declare module 'fastify' {
  interface FastifyRequest {
    schoolId?: string
    schoolHint?: string
  }
}
