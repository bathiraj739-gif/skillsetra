import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { studentService } from '../../services/studentService'
import { resultService } from '../../services/resultService'
import type { AssessmentAssignment, Assessment, Result } from '../../types'
import {
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  Award,
  Clock,
  ArrowRight,
  Brain,
  MessageSquare,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

export const StudentDashboard: React.FC = () => {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<(AssessmentAssignment & { assessment: Assessment })[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = React.useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    setError(null)
    try {
      const [assData, resData] = await Promise.all([
        studentService.getMyAssignedAssessments(profile.id),
        resultService.getMyResults(profile.id),
      ])
      setAssignments(assData || [])
      setResults(resData || [])
    } catch (err: unknown) {
      console.error('Failed to load student dashboard data:', err)
      setError('Unable to fetch latest assessments from server.')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    loadData()
    const interval = setInterval(() => {
      loadData()
    }, 10000)
    return () => clearInterval(interval)
  }, [profile?.id, loadData])

  const totalAssigned = assignments.length
  const completedCount = results.length
  const avgPercentage =
    results.length > 0
      ? Math.round(results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length)
      : 0
  const latestResult = results[0]

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-100">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Campus Placement Assessment Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {profile?.name || 'Candidate'}!
          </h1>
          <p className="mt-2 text-indigo-100 text-sm leading-relaxed">
            Ready for your placement evaluation? Hone your Aptitude and Verbal reasoning skills through practice and proctored assessments.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-indigo-200">
            <span>Reg. No: <strong className="text-white">{profile?.register_number || 'N/A'}</strong></span>
            <span>•</span>
            <span>Department: <strong className="text-white">{profile?.department || 'General'}</strong></span>
            <span>•</span>
            <span>Year: <strong className="text-white">{profile?.year || '1'}st/2nd/3rd/4th</strong></span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="text-xs font-bold underline hover:text-rose-800">
            Retry
          </button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Tests</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : totalAssigned}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : completedCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : `${avgPercentage}%`}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Latest Score</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : latestResult ? `${latestResult.percentage}%` : 'N/A'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Grid: Active/Assigned Assessments & Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Assigned Assessments */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Assigned Assessments</span>
            </h2>
            <Link to="/student/assessments" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-2 text-xs text-slate-500 font-medium">Loading assigned assessments...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-700">No Assessments Assigned Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Your placement officer or administrator will assign Aptitude and Verbal tests here soon.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((item) => {
                const ass = item.assessment
                if (!ass) return null
                const totalQ = (ass.aptitude_count || 0) + (ass.verbal_count || 0)

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs hover:border-indigo-100 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold uppercase tracking-wider">
                          {ass.status || 'Active'}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {ass.duration_minutes} Mins
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{ass.title}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1">{ass.description || 'Campus Placement Evaluation'}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-600 pt-1">
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <Brain className="w-3.5 h-3.5" /> Aptitude: {ass.aptitude_count} Qs
                        </span>
                        <span className="flex items-center gap-1 text-teal-600 font-medium">
                          <MessageSquare className="w-3.5 h-3.5" /> Verbal: {ass.verbal_count} Qs
                        </span>
                        <span className="font-semibold text-slate-900">Total: {totalQ} Qs</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {item.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completed
                        </span>
                      ) : (
                        <Link
                          to={`/student/assessment/${ass.id}/instructions`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all"
                        >
                          Start Assessment
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

        {/* Right 1 Col: Recent Scorecard Log */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <span>Recent Results</span>
          </h2>

          {loading ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center text-xs text-slate-500">
              No test results recorded yet.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
              {results.slice(0, 4).map((res) => (
                <div key={res.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                      {res.assessment?.title || 'Placement Mock Test'}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Apt: {res.aptitude_score} | Ver: {res.verbal_score} | Total: {res.total_score}/{res.total_questions}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-extrabold">
                      {res.percentage}%
                    </span>
                    <Link
                      to={`/student/result/${res.id}`}
                      className="block text-[10px] font-semibold text-indigo-600 hover:underline mt-1"
                    >
                      View Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
