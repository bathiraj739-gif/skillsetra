import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/common/Logo'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

export const StudentRegister: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center flex flex-col items-center">
        <Logo size="lg" className="mb-4" />
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Registration Closed</h2>
          <p className="text-xs text-slate-600">
            Public student self-registration is disabled. Student accounts are created exclusively by the Placement Administrator.
          </p>
          <div className="pt-4 border-t border-slate-100">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Student Login</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
