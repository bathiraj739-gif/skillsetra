import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { resultService } from '../../services/resultService'
import type { Result } from '../../types'
import { Award, ArrowRight, HelpCircle, AlertCircle } from 'lucide-react'

export const StudentResults: React.FC = () => {
  const { profile } = useAuth()
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.id) return
    let isMounted = true
    setLoading(true)
    setError(null)

    resultService
      .getMyResults(profile.id)
      .then((data) => {
        if (isMounted) setResults(data || [])
      })
      .catch((err: unknown) => {
        if (isMounted) {
          console.error('Failed to fetch student results history:', err)
          setError('Unable to load test results history.')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [profile?.id])

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-indigo-600" />
          <span>Results & Performance History</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review scorecards and Aptitude/Verbal marks for all completed placement assessments.
        </p>
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
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading result history...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Evaluation Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You have not completed any placement assessments yet.
          </p>
          <Link
            to="/student/assessments"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200"
          >
            View Available Assessments
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Assessment Title</th>
                  <th className="py-4 px-4 text-center">Aptitude Score</th>
                  <th className="py-4 px-4 text-center">Verbal Score</th>
                  <th className="py-4 px-4 text-center">Total Score</th>
                  <th className="py-4 px-4 text-center">Percentage</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {results.map((res) => {
                  const isPassed = res.percentage >= (res.assessment?.passing_percentage || 50)

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {res.assessment?.title || 'Placement Assessment'}
                        <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                          Submitted {new Date(res.created_at || res.submitted_at || Date.now()).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-amber-700">
                        {res.aptitude_score}
                      </td>

                      <td className="py-4 px-4 text-center font-semibold text-teal-700">
                        {res.verbal_score}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-slate-900">
                        {res.total_score} / {res.total_questions}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {res.percentage}%
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/student/result/${res.id}`}
                          className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          <span>View Report</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
