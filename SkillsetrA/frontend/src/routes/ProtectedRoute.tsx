import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  loginPath?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ loginPath = '/login' }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium text-sm">Verifying session...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={loginPath} replace />
  }

  return <Outlet />
}

