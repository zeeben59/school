import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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
    clearStorage()
    setToken(null)
    setUser(null)
    setLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken()
    if (!currentToken) {
      logout()
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      })

      if (res.ok) {
        const data = await res.json()
        setUser(data)
        const storageTarget = localStorage.getItem('token') ? localStorage : sessionStorage
        storageTarget.setItem('user', JSON.stringify(data))
      } else {
        logout()
      }
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
