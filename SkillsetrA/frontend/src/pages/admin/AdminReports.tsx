import React, { useEffect, useState } from 'react'
import { resultService } from '../../services/resultService'
import type { Result } from '../../types'
import { FileText, Award, TrendingUp, Brain, MessageSquare, CheckCircle2, XCircle } from 'lucide-react'

export const AdminReports: React.FC = () => {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportsData()
  }, [])

  const loadReportsData = async () => {
    setLoading(true)
    try {
      const data = await resultService.getAllResults()
      setResults(data || [])
    } catch (err) {
      console.error('Failed to load reports data:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalEvaluated = results.length
  const avgTotalPercentage =
    totalEvaluated > 0
      ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / totalEvaluated)
      : 0

  const avgAptitude =
    totalEvaluated > 0
      ? (results.reduce((acc, r) => acc + (r.aptitude_score || 0), 0) / totalEvaluated).toFixed(1)
      : '0'

  const avgVerbal =
    totalEvaluated > 0
      ? (results.reduce((acc, r) => acc + (r.verbal_score || 0), 0) / totalEvaluated).toFixed(1)
      : '0'

  const highestScore = totalEvaluated > 0 ? Math.max(...results.map((r) => r.percentage)) : 0

  const passCount = results.filter((r) => r.percentage >= (r.assessment?.passing_percentage || 50)).length
  const failCount = totalEvaluated - passCount

  const deptStats: Record<string, { total: number; sumPct: number }> = {}
  results.forEach((r) => {
    const d = r.student?.department || 'General'
    if (!deptStats[d]) deptStats[d] = { total: 0, sumPct: 0 }
    deptStats[d].total += 1
    deptStats[d].sumPct += r.percentage || 0
  })

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          <span>Placement Analytics & Reports</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Performance metrics, section averages, and department distribution for campus placement readiness.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : `${avgTotalPercentage}%`}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Aptitude Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : `${avgAptitude} Marks`}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Verbal Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : `${avgVerbal} Marks`}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Highest Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : `${highestScore}%`}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Pass / Fail Threshold Analysis</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-emerald-800 uppercase">Candidates Passed</p>
              <h3 className="text-3xl font-black text-emerald-950 mt-1">{loading ? '...' : passCount}</h3>
              <p className="text-[11px] text-emerald-700 mt-1">
                {totalEvaluated > 0 ? `${Math.round((passCount / totalEvaluated) * 100)}% Pass Rate` : '0%'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center">
              <XCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-rose-800 uppercase">Below Threshold</p>
              <h3 className="text-3xl font-black text-rose-950 mt-1">{loading ? '...' : failCount}</h3>
              <p className="text-[11px] text-rose-700 mt-1">
                {totalEvaluated > 0 ? `${Math.round((failCount / totalEvaluated) * 100)}% Retake Needed` : '0%'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900">Department Performance Averages</h2>

          {Object.keys(deptStats).length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">No evaluation data available across departments.</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(deptStats).map(([dept, data]) => {
                const deptAvg = Math.round(data.sumPct / data.total)
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>{dept}</span>
                      <span>{deptAvg}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${deptAvg}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
