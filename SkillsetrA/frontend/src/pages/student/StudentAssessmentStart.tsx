import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { assessmentService } from '../../services/assessmentService'
import type { Assessment } from '../../types'
import { ShieldAlert, Clock, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Brain, MessageSquare } from 'lucide-react'

export const StudentAssessmentStart: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    loadAssessment()
  }, [id])

  const loadAssessment = async () => {
    setLoading(true)
    try {
      const data = await assessmentService.getAssessmentById(id!)
      if (!data) throw new Error('Assessment not found')
      setAssessment(data)
    } catch (e: any) {
      console.error('Error fetching assessment instructions:', e)
      setError('Failed to load assessment instructions.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-sm font-semibold text-slate-600">Loading instructions...</p>
      </div>
    )
  }

  if (error || !assessment) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Assessment Unavailable</h2>
        <p className="text-xs text-slate-500">{error || 'This assessment could not be found.'}</p>
        <Link to="/student/assessments" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Assessments
        </Link>
      </div>
    )
  }

  const totalQuestions = (assessment.aptitude_count || 0) + (assessment.verbal_count || 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/student/assessments" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to Assessments
      </Link>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="border-b border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Placement Mock Test
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">{assessment.title}</h1>
            <p className="text-xs text-slate-500 mt-1">{assessment.description || 'Standard Placement Assessment'}</p>
          </div>

          <div className="flex items-center gap-3 bg-indigo-600 text-white px-5 py-3 rounded-2xl shadow-md shadow-indigo-200">
            <Clock className="w-6 h-6" />
            <div>
              <p className="text-[10px] uppercase font-bold text-indigo-200 tracking-wider">Duration</p>
              <p className="text-base font-extrabold leading-tight">{assessment.duration_minutes} Minutes</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-800 uppercase block">Aptitude MCQ</span>
              <strong className="text-lg font-extrabold text-amber-950">{assessment.aptitude_count} Questions</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-teal-800 uppercase block">Verbal MCQ</span>
              <strong className="text-lg font-extrabold text-teal-950">{assessment.verbal_count} Questions</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-indigo-800 uppercase block">Passing Mark</span>
              <strong className="text-lg font-extrabold text-indigo-950">{assessment.passing_percentage}%</strong>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Exam Guidelines & Instructions</h3>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">1</span>
              <span><strong>Backend Randomization:</strong> Your question set has been randomly chosen and locked to your attempt. Navigating or refreshing the browser will restore your exact questions and saved answers without resetting progress.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">2</span>
              <span><strong>Autosave:</strong> Every selected response is automatically saved to the database.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">3</span>
              <span><strong>Timer:</strong> The timer begins immediately when you click <strong>Start Assessment</strong>. The exam auto-submits when the timer reaches 00:00.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">4</span>
              <span><strong>Navigation & Review:</strong> You may navigate freely between questions using the Question Palette or Next/Previous controls and mark questions for later review.</span>
            </li>
          </ul>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Total Questions: <strong className="text-slate-900">{totalQuestions}</strong> | Duration: <strong className="text-slate-900">{assessment.duration_minutes} Mins</strong>
          </div>

          <button
            onClick={() => navigate(`/student/assessment/${assessment.id}`)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <span>Start Assessment Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
