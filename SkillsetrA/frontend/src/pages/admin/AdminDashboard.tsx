import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { studentService } from '../../services/studentService'
import { questionService } from '../../services/questionService'
import { assessmentService } from '../../services/assessmentService'
import { attemptService } from '../../services/attemptService'
import { resultService } from '../../services/resultService'
import {
  Users,
  FileCheck,
  Radio,
  BarChart2,
  Brain,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalQuestions: 0,
    aptitudeCount: 0,
    verbalCount: 0,
    totalAssessments: 0,
    activeAttempts: 0,
    completedResults: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    setLoading(true)
    try {
      const [
        students,
        questions,
        assessments,
        attempts,
        results,
      ] = await Promise.all([
        studentService.getAllStudents(),
        questionService.getQuestions(),
        assessmentService.getAssessments(),
        attemptService.getLiveAttempts(),
        resultService.getAllResults(),
      ])

      const allQuestions = questions || []
      const apt = allQuestions.filter((q) => q.section === 'aptitude').length
      const ver = allQuestions.filter((q) => q.section === 'verbal').length
      const activeCount = (attempts || []).filter((a: any) => a.status === 'in_progress').length

      setStats({
        totalStudents: (students || []).length,
        totalQuestions: allQuestions.length,
        aptitudeCount: apt,
        verbalCount: ver,
        totalAssessments: (assessments || []).length,
        activeAttempts: activeCount,
        completedResults: (results || []).length,
      })
    } catch (err) {
      console.error('Failed to load admin stats:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            TPO & Placement Administration Control Panel
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Skillsetr<span className="text-indigo-400">A</span> Admin Overview
          </h1>
          <p className="mt-2 text-slate-300 text-sm leading-relaxed">
            Manage your Aptitude and Verbal question banks, publish assessments, track live candidate attempts, and evaluate placement readiness.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Candidates</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : stats.totalStudents}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Question Bank</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">
              {loading ? '...' : `${stats.totalQuestions} Qs`}
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Aptitude: {stats.aptitudeCount} | Verbal: {stats.verbalCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assessments</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : stats.totalAssessments}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Tests</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{loading ? '...' : stats.completedResults}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/admin/questions"
          className="group bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-4"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold text-sm">
            01
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
              <span>Question Bank</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Manage Aptitude & Verbal questions, import TXT files, and customize active status.</p>
          </div>
        </Link>

        <Link
          to="/admin/assessments"
          className="group bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-4"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-extrabold text-sm">
            02
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
              <span>Assessment Management</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Create placement mock tests with direct Question Bank question selection.</p>
          </div>
        </Link>

        <Link
          to="/admin/monitoring"
          className="group bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all space-y-4"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-sm flex-shrink-0">
            <Radio className="w-5 h-5 text-emerald-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
              <span>Live Test Monitoring</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
            </h3>
            <p className="text-xs text-slate-500 mt-1">Monitor real-time student activity during active assessment attempts.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
