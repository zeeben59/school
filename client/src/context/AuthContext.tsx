import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { API_BASE } from '../lib/config'

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
      const currentToken = getStoredToken()
      if (!currentToken) {
        logout()
        return
      }
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      })
      if (!response.ok) {
        logout()
        return
      }
      const mapped = await response.json()
      const storageTarget = localStorage.getItem('token') ? localStorage : sessionStorage
      storageTarget.setItem('token', currentToken)
      storageTarget.setItem('user', JSON.stringify(mapped))
      setToken(currentToken)
      setUser(mapped)
    } catch (err) {
      console.error('Auth refresh error:', err)
      logout()
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
