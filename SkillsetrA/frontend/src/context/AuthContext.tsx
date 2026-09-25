import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Profile, UserRole } from '../types'
import { authService } from '../services/authService'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

export interface AuthContextType {
  user: AuthUser | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  isConfigured: boolean
  signIn: (identifier?: string, pass?: string) => Promise<{ error?: string }>
  adminSignIn: (identifier?: string, pass?: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const syncCurrentUser = async () => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('auth_token')
    if (!token) {
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      const u = await authService.getCurrentUser()
      if (u) {
        const roleLower = String(u.role || 'student').toLowerCase() as UserRole
        const userObj: AuthUser = {
          id: u.id || u.studentId || u.userId || '',
          email: u.email || '',
          role: roleLower,
        }
        const profileObj: Profile = {
          id: u.studentId || u.id || u.userId || '',
          name: u.name || u.username || u.email || 'User',
          username: u.username || u.email?.split('@')[0],
          email: u.email || '',
          role: roleLower,
          register_number: u.registerNumber,
          department: u.department,
          year_of_study: u.yearOfStudy,
        }
        setUser(userObj)
        setProfile(profileObj)
      } else {
        setUser(null)
        setProfile(null)
      }
    } catch (err) {
      console.warn('Could not sync current user profile:', err)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    syncCurrentUser()
  }, [])

  const refreshProfile = async () => {
    await syncCurrentUser()
  }

  const signIn = async (identifier?: string, pass?: string) => {
    if (!identifier || !pass) {
      return { error: 'Username/Email and password are required' }
    }
    try {
      setLoading(true)
      const res = await authService.studentLogin(identifier, pass)
      if (res.success || res.token) {
        await syncCurrentUser()
        return {}
      }
      return { error: res.message || 'Login failed' }
    } catch (err: any) {
      return { error: err.message || 'Student authentication failed' }
    } finally {
      setLoading(false)
    }
  }

  const adminSignIn = async (identifier?: string, pass?: string) => {
    if (!identifier || !pass) {
      return { error: 'Email and password are required' }
    }
    try {
      setLoading(true)
      const res = await authService.adminLogin(identifier, pass)
      if (res.success || res.token) {
        await syncCurrentUser()
        return {}
      }
      return { error: res.message || 'Admin login failed' }
    } catch (err: any) {
      return { error: err.message || 'Admin authentication failed' }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      await authService.logout()
    } catch {}
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        loading,
        isConfigured: true,
        signIn,
        adminSignIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
