import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft, ShieldCheck } from 'lucide-react'

export const Unauthorized: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h1>
        <p className="text-slate-600 text-sm mt-2">
          You do not have permission to view this page. Placement Administrator privileges are required to access this resource.
        </p>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
          <Link
            to="/admin/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Sign In to Placement Admin Portal
          </Link>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Student Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

