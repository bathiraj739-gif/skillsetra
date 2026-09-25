import React, { useEffect, useState } from 'react'
import { resultService } from '../../services/resultService'
import { DEPARTMENTS } from '../../constants/departments'
import type { Result } from '../../types'
import { BarChart2, Search, HelpCircle, AlertCircle } from 'lucide-react'

export const AdminResults: React.FC = () => {
  const [results, setResults] = useState<Result[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadResults()
    const interval = setInterval(() => {
      loadResults()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadResults = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await resultService.getAllResults()
      setResults(data || [])
    } catch (err: any) {
      console.error('Failed to load admin results:', err)
      setError('Unable to fetch candidate results list.')
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = results.filter((r) => {
    const studentName = r.student?.name || ''
    const regNo = r.student?.register_number || ''
    const testTitle = r.assessment?.title || ''

    const matchSearch =
      studentName.toLowerCase().includes(search.toLowerCase()) ||
      regNo.toLowerCase().includes(search.toLowerCase()) ||
      testTitle.toLowerCase().includes(search.toLowerCase())

    const matchDept = deptFilter === 'all' || r.student?.department === deptFilter

    return matchSearch && matchDept
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600" />
            <span>Candidate Performance & Evaluated Results</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time score evaluations, percentages, and performance metrics across all candidates.
          </p>
        </div>

        <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
          Total Submissions: {filteredResults.length}
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, reg no, assessment title..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Departments</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading candidate evaluation records...</p>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
          <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Evaluation Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No student results match the specified criteria.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Candidate Name</th>
                  <th className="py-4 px-4">Register No & Dept</th>
                  <th className="py-4 px-4">Assessment Title</th>
                  <th className="py-4 px-4 text-center">Aptitude</th>
                  <th className="py-4 px-4 text-center">Verbal</th>
                  <th className="py-4 px-4 text-center">Total Score</th>
                  <th className="py-4 px-4 text-center">Percentage</th>
                  <th className="py-4 px-6 text-right">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredResults.map((r) => {
                  const isPassed = r.percentage >= (r.assessment?.passing_percentage || 50)

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {r.student?.name || r.student?.full_name || (r as any).student_name || (r as any).full_name || (r as any).candidate_name || 'Candidate'}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        <span className="font-mono text-slate-700 font-semibold">{r.student?.register_number || 'N/A'}</span>
                        <span className="block text-[10px] text-slate-400">{r.student?.department}</span>
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-800">
                        {r.assessment?.title || 'Mock Test'}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-amber-700">
                        {r.aptitude_score}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-teal-700">
                        {r.verbal_score}
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-slate-900">
                        {r.total_score} / {r.total_questions}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                            isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.percentage}%
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(r.created_at || r.submitted_at || Date.now()).toLocaleDateString()}
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
