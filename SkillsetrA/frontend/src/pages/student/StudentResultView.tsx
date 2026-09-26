import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { resultService } from '../../services/resultService'
import type { Result } from '../../types'
import { Award, CheckCircle2, XCircle, HelpCircle, Clock, ArrowLeft, Brain, MessageSquare } from 'lucide-react'

export const StudentResultView: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let isMounted = true
    setLoading(true)

    resultService
      .getResultById(id)
      .then((data) => {
        if (isMounted) setResult(data)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          console.error('Failed to load result:', err)
          setError('Unable to fetch result scorecard.')
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-3 text-sm font-semibold text-slate-600">Retrieving official test scorecard...</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-4">
        <Award className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Scorecard Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'This result record could not be loaded.'}</p>
        <Link to="/student/dashboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    )
  }

  const isPassed = result.percentage >= (result.assessment?.passing_percentage || 50)
  const timeSec = result.time_taken_seconds || 0
  const formattedTime = `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`
  const subDate = new Date(result.created_at || result.submitted_at || Date.now())

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/student/results" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="w-4 h-4" /> Back to Results History
      </Link>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/40 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 mx-auto shadow-xs">
          <Award className="w-9 h-9" />
        </div>

        <div>
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
              isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {isPassed ? 'Passed Assessment' : 'Needs Improvement'}
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            {result.assessment?.title || 'Placement Mock Assessment'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submitted on {subDate.toLocaleDateString()} at {subDate.toLocaleTimeString()}
          </p>
        </div>

        <div className="bg-gradient-to-tr from-indigo-700 to-indigo-600 rounded-3xl p-6 text-white max-w-sm mx-auto shadow-lg shadow-indigo-100">
          <p className="text-xs uppercase font-bold text-indigo-200 tracking-wider">Overall Percentage</p>
          <h2 className="text-5xl font-black mt-1 tracking-tight">{result.percentage ?? 0}%</h2>
          <p className="text-xs text-indigo-100 mt-2 font-medium">
            Total Score: {result.total_score ?? result.score ?? 0} / {result.total_questions ?? result.total_marks ?? 0}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-amber-900">Aptitude Score</p>
                <p className="text-[11px] text-amber-700">Numerical & Logical</p>
              </div>
            </div>
            <strong className="text-xl font-extrabold text-amber-950">{result.aptitude_score ?? 0} Marks</strong>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-teal-900">Verbal Score</p>
                <p className="text-[11px] text-teal-700">English & Grammar</p>
              </div>
            </div>
            <strong className="text-xl font-extrabold text-teal-950">{result.verbal_score ?? 0} Marks</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-50 p-3.5 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" /> Correct
            </div>
            <strong className="text-xl font-bold text-slate-900">{result.correct_answers ?? 0}</strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-rose-600 text-xs font-bold mb-1">
              <XCircle className="w-4 h-4" /> Incorrect
            </div>
            <strong className="text-xl font-bold text-slate-900">{result.incorrect_answers ?? result.wrong_answers ?? 0}</strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-slate-500 text-xs font-bold mb-1">
              <HelpCircle className="w-4 h-4" /> Unanswered
            </div>
            <strong className="text-xl font-bold text-slate-900">{result.unanswered ?? 0}</strong>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl text-center">
            <div className="flex items-center justify-center gap-1 text-indigo-600 text-xs font-bold mb-1">
              <Clock className="w-4 h-4" /> Time Taken
            </div>
            <strong className="text-sm font-bold text-slate-900">{formattedTime}</strong>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/student/dashboard"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition-all text-center"
          >
            Back to Dashboard
          </Link>
          <Link
            to="/student/results"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all text-center"
          >
            View Results History
          </Link>
        </div>
      </div>

      {/* Answer Report Section */}
      {result.answer_report && result.answer_report.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6 text-left">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-extrabold text-slate-900">Answer Report</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed question-by-question response breakdown for this attempt.
            </p>
          </div>

          <div className="space-y-6">
            {result.answer_report.map((item) => {
              const getOptionText = (optKey: string | null) => {
                if (!optKey) return 'Not Answered'
                const keyUpper = optKey.toUpperCase()
                if (keyUpper === 'A') return `A. ${item.option_a}`
                if (keyUpper === 'B') return `B. ${item.option_b}`
                if (keyUpper === 'C') return `C. ${item.option_c}`
                if (keyUpper === 'D') return `D. ${item.option_d}`
                return optKey
              }

              const studentAnsText = getOptionText(item.selected_option)
              const correctAnsText = getOptionText(item.correct_option)

              const isCorrect = item.status === 'Correct'
              const isWrong = item.status === 'Wrong'

              return (
                <div
                  key={item.question_id || item.question_number}
                  className="p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4"
                >
                  {/* Header: Question Number, Status Badge, Marks */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <span className="text-sm font-extrabold text-indigo-700">
                      Question {item.question_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-0.5 rounded-full text-xs font-bold ${
                          isCorrect
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isWrong
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                      >
                        Status: {item.status}
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                        Marks: {item.marks_awarded} / {item.question_marks}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Question:</p>
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                      {item.question_text}
                    </p>
                  </div>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div
                      className={`p-2.5 rounded-xl text-xs font-medium border ${
                        item.correct_option === 'A'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                          : item.selected_option === 'A' && isWrong
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold mr-1">A.</span> {item.option_a}
                    </div>

                    <div
                      className={`p-2.5 rounded-xl text-xs font-medium border ${
                        item.correct_option === 'B'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                          : item.selected_option === 'B' && isWrong
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold mr-1">B.</span> {item.option_b}
                    </div>

                    <div
                      className={`p-2.5 rounded-xl text-xs font-medium border ${
                        item.correct_option === 'C'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                          : item.selected_option === 'C' && isWrong
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold mr-1">C.</span> {item.option_c}
                    </div>

                    <div
                      className={`p-2.5 rounded-xl text-xs font-medium border ${
                        item.correct_option === 'D'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                          : item.selected_option === 'D' && isWrong
                          ? 'bg-rose-50 border-rose-300 text-rose-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="font-bold mr-1">D.</span> {item.option_d}
                    </div>
                  </div>

                  {/* Student Answer vs Correct Answer Summary */}
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Student Answer:
                      </span>
                      <span
                        className={`font-extrabold ${
                          isCorrect
                            ? 'text-emerald-700'
                            : isWrong
                            ? 'text-rose-700'
                            : 'text-slate-500 italic'
                        }`}
                      >
                        {studentAnsText}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                        Correct Answer:
                      </span>
                      <span className="font-extrabold text-emerald-700">
                        {correctAnsText}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

