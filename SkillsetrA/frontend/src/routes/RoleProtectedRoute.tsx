import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface RoleProtectedRouteProps {
  allowedRole: UserRole
  redirectPath?: string
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ allowedRole, redirectPath }) => {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium text-sm">Authenticating authorization...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    const fallbackPath = redirectPath || (allowedRole === 'admin' ? '/admin/login' : '/login')
    return <Navigate to={fallbackPath} replace />
  }

  if (allowedRole === 'admin') {
    if (role !== 'admin') {
      return <Navigate to={redirectPath || '/admin/login'} replace />
    }
  }

  if (allowedRole === 'student') {
    if (role !== 'student') {
      return <Navigate to={redirectPath || '/login'} replace />
    }
  }

  return <Outlet />
}

