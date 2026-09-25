import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { studentService } from '../../services/studentService'
import type { AssessmentAssignment, Assessment } from '../../types'
import { FileSpreadsheet, Clock, CheckCircle2, ArrowRight, Brain, MessageSquare, AlertCircle, HelpCircle } from 'lucide-react'

export const StudentAssessments: React.FC = () => {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<(AssessmentAssignment & { assessment: Assessment })[]>([])
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.id) {
      loadData()
    }
  }, [profile?.id])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await studentService.getMyAssignedAssessments(profile!.id)
      setAssignments(data || [])
    } catch (err) {
      console.error('Failed to load student assessments:', err)
      setError('Unable to load assigned assessments.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = assignments.filter((item) => {
    if (filter === 'assigned') return item.status !== 'completed'
    if (filter === 'completed') return item.status === 'completed'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            <span>My Assessments</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access proctored online aptitude and verbal tests assigned to your account.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({assignments.length})
          </button>
          <button
            onClick={() => setFilter('assigned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'assigned' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Available ({assignments.filter((a) => a.status !== 'completed').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'completed' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({assignments.filter((a) => a.status === 'completed').length})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-100">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Fetching your assigned assessments...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Assessments Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {filter === 'all'
              ? 'You do not have any assigned assessments currently.'
              : `No assessments found under "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((item) => {
            const ass = item.assessment
            if (!ass) return null
            const totalQ = (ass.aptitude_count || 0) + (ass.verbal_count || 0)

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">
                      {ass.status || 'Active'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      {ass.duration_minutes} Mins
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{ass.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {ass.description || 'Proctored placement test covering numerical, logical, and verbal aptitude.'}
                  </p>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Aptitude</span>
                      <strong className="text-amber-600 text-sm font-bold flex items-center justify-center gap-1">
                        <Brain className="w-3.5 h-3.5" /> {ass.aptitude_count} Qs
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Verbal</span>
                      <strong className="text-teal-600 text-sm font-bold flex items-center justify-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" /> {ass.verbal_count} Qs
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total</span>
                      <strong className="text-slate-900 text-sm font-bold">{totalQ} Qs</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Passing: <strong className="text-slate-700">{ass.passing_percentage}%</strong>
                  </span>

                  {item.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed
                    </span>
                  ) : (
                    <Link
                      to={`/student/assessment/${ass.id}/instructions`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
                    >
                      <span>Start Assessment</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
