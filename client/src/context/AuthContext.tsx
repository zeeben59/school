import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  school: string
  schoolId: string
  status: string
  logoUrl?: string
  address?: string
  phone?: string
  emailVerifiedAt?: string | null
  mustChangePassword?: boolean
  hasActiveSubscription?: boolean
  accessState?: 'PENDING_PAYMENT' | 'SUBSCRIPTION_REQUIRED' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, user: User, remember?: boolean) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const getStoredToken = () => localStorage.getItem('token') || sessionStorage.getItem('token')
const getStoredUser = () => localStorage.getItem('user') || sessionStorage.getItem('user')
const DEFAULT_USER_FALLBACK = 'User'

const mapSupabaseUser = (supabaseUser: any): User => {
  const meta = supabaseUser?.user_metadata ?? {}
  const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : ''
  const names = fullName ? fullName.split(/\s+/) : []
  const firstName = typeof meta.first_name === 'string' && meta.first_name.trim()
    ? meta.first_name.trim()
    : names[0] || DEFAULT_USER_FALLBACK
  const lastName = typeof meta.last_name === 'string' && meta.last_name.trim()
    ? meta.last_name.trim()
    : names.slice(1).join(' ')

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    firstName,
    lastName,
    role: typeof meta.role === 'string' ? meta.role : 'DIRECTOR',
    school: typeof meta.school === 'string' ? meta.school : '',
    schoolId: typeof meta.schoolId === 'string' ? meta.schoolId : '',
    status: typeof meta.status === 'string' ? meta.status : 'ACTIVE',
    phone: typeof meta.phone === 'string' ? meta.phone : undefined,
    address: typeof meta.address === 'string' ? meta.address : undefined,
    logoUrl: typeof meta.logoUrl === 'string' ? meta.logoUrl : undefined,
    emailVerifiedAt: supabaseUser.email_confirmed_at ?? null,
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [loading, setLoading] = useState(true)

  const clearStorage = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  const logout = useCallback(() => {
    void supabase.auth.signOut()
    clearStorage()
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) {
        logout()
        return
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        logout()
        return
      }

      const mapped = mapSupabaseUser(userData.user)
      const currentToken = sessionData.session.access_token
      const storageTarget = localStorage.getItem('token') ? localStorage : sessionStorage
      storageTarget.setItem('token', currentToken)
      storageTarget.setItem('user', JSON.stringify(mapped))
      setToken(currentToken)
      setUser(mapped)
    } catch (err) {
      console.error('Auth refresh error:', err)
      const cached = getStoredUser()
      if (!cached) logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    const storedUser = getStoredUser()
    const storedToken = getStoredToken()

    if (storedUser && storedToken) {
      try {
        const parsedUser = JSON.parse(storedUser)
        if (parsedUser && typeof parsedUser === 'object' && parsedUser.id && parsedUser.firstName) {
          setUser(parsedUser)
          setLoading(false)
          refreshUser()
        } else {
          console.warn('Incomplete auth cache found. Forcing refresh.')
          refreshUser()
        }
      } catch (err) {
        console.error('Failed to parse auth cache:', err)
        refreshUser()
      }
    } else if (storedToken) {
      refreshUser()
    } else {
      setLoading(false)
    }
  }, [refreshUser])

  const login = (newToken: string, newUser: User, remember = true) => {
    if (remember) {
      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(newUser))
    } else {
      sessionStorage.setItem('token', newToken)
      sessionStorage.setItem('user', JSON.stringify(newUser))
    }
    setToken(newToken)
    setUser(newUser)
  }

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null
      const updated = { ...prev, ...updates }
      const storageTarget = localStorage.getItem('token') ? localStorage : sessionStorage
      storageTarget.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
