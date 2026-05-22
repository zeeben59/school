import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] Missing Supabase env keys. Configure SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.')
}

function buildStub() {
  return {
    auth: {
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
      getUser: async () => ({ data: null, error: new Error('Supabase not configured') }),
      admin: {
        createUser: async () => ({ data: null, error: new Error('Supabase not configured') }),
      },
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: new Error('Supabase not configured') }),
        }),
      }),
      insert: async () => ({ data: null, error: new Error('Supabase not configured') }),
    }),
  }
}

const authKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY
const supabaseAuth: any = SUPABASE_URL && authKey
  ? createClient(SUPABASE_URL, authKey, { auth: { persistSession: false } })
  : buildStub()

const supabaseAdmin: any = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : buildStub()

export { supabaseAuth, supabaseAdmin }
