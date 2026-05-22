import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const missingConfigError = () =>
  new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.')

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!isConfigured) {
  console.error('[client supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

const fallbackSupabase = {
  auth: {
    signUp: async () => ({ data: null, error: missingConfigError() }),
    signInWithPassword: async () => ({ data: null, error: missingConfigError() }),
    getUser: async () => ({ data: { user: null }, error: missingConfigError() }),
    getSession: async () => ({ data: { session: null }, error: missingConfigError() }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ data: null, error: missingConfigError() }),
    updateUser: async () => ({ data: null, error: missingConfigError() }),
    resend: async () => ({ data: null, error: missingConfigError() }),
  },
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (fallbackSupabase as any)
