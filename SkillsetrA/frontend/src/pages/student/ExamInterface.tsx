import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { attemptService } from '../../services/attemptService'
import type { ExamQuestion, QuestionOption, StartAttemptResponse } from '../../types'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  XCircle,
  Send,
  AlertTriangle,
  Brain,
  MessageSquare,
} from 'lucide-react'

export const ExamInterface: React.FC = () => {
  const { id: assessmentId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [attemptData, setAttemptData] = useState<StartAttemptResponse | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuestionOption | null>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({})

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showSubmitModal, setShowSubmitModal] = useState(false)

  const [autoSubmittedNotice, setAutoSubmittedNotice] = useState(false)

  useEffect(() => {
    if (!assessmentId) return
    initAttempt()
  }, [assessmentId])

  const initAttempt = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await attemptService.startAttempt(assessmentId!)
      setAttemptData(res)

      const statusLower = (res.status || '').toLowerCase()
      if (statusLower === 'submitted' || statusLower === 'auto_submitted' || statusLower === 'completed') {
        const attemptId = res.attempt_id || res.id
        navigate(`/student/result/${attemptId}`)
        return
      }

      const initialAnswers: Record<string, QuestionOption | null> = {}
      const initialMarked: Record<string, boolean> = {}

      if (res.saved_answers && res.saved_answers.length > 0) {
        res.saved_answers.forEach((sa) => {
          const qId = sa.question_id || sa.questionId
          if (qId) {
            if (sa.selected_answer || sa.selectedOption) initialAnswers[qId] = (sa.selected_answer || sa.selectedOption) as QuestionOption
            if (sa.is_marked_for_review) initialMarked[qId] = true
          }
        })
      }

      setAnswers(initialAnswers)
      setMarkedForReview(initialMarked)

      let remainingSec = 0
      if (res.remaining_seconds != null || res.remainingSeconds != null) {
        remainingSec = Math.max(0, Number(res.remaining_seconds ?? res.remainingSeconds))
      } else {
        const startedAt = new Date(res.started_at || res.startedAt || Date.now()).getTime()
        const durationMins = res.assessment?.duration_minutes || 30
        const durationMs = durationMins * 60 * 1000
        const now = new Date().getTime()
        const elapsedMs = now - startedAt
        remainingSec = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000))
      }

      if (remainingSec <= 0) {
        const attemptId = res.attempt_id || res.id
        if (attemptId) {
          await attemptService.submitAttempt(attemptId)
          navigate(`/student/result/${attemptId}`)
        } else {
          navigate('/student/results')
        }
        return
      }

      setTimeLeftSeconds(remainingSec)
    } catch (err: any) {
      console.error('Error starting attempt:', err)
      setError(err?.message || 'Failed to start assessment attempt.')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalSubmit = useCallback(async (isAutoParam?: any) => {
    const isAuto = typeof isAutoParam === 'boolean' ? isAutoParam : false
    const attId = attemptData?.attempt_id || attemptData?.id
    if (!attId || submitting) return
    setSubmitting(true)

    if (isAuto) {
      setAutoSubmittedNotice(true)
    }
    try {
      const res = await attemptService.submitAttempt(attId)
      const targetId = res?.result_id || res?.result?.id || res?.id || attId
      setTimeout(() => {
        navigate(`/student/result/${targetId}`)
      }, isAuto ? 1500 : 0)
    } catch (err: any) {
      console.error('Submission failed:', err)
      if (!isAuto) {
        alert('Error submitting test: ' + (err?.message || 'Unknown error'))
        setSubmitting(false)
      } else {
        navigate(`/student/result/${attId}`)
      }
    }
  }, [attemptData?.attempt_id, attemptData?.id, navigate, submitting])

  useEffect(() => {
    if (timeLeftSeconds === null) return

    if (timeLeftSeconds <= 0) {
      handleFinalSubmit(true)
      return
    }

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          handleFinalSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLeftSeconds, handleFinalSubmit])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleSelectOption = (option: QuestionOption) => {
    if (!attemptData || !attemptData.questions || submitting || (timeLeftSeconds !== null && timeLeftSeconds <= 0)) return
    const currentQ = attemptData.questions[currentIndex]
    if (!currentQ) return

    const newAns = { ...answers, [currentQ.id]: option }
    setAnswers(newAns)

    const attId = attemptData.attempt_id || attemptData.id || ''
    attemptService.saveAnswer({
      attempt_id: attId,
      attemptId: attId,
      question_id: currentQ.id,
      questionId: currentQ.id,
      selected_answer: option,
      selectedOption: option,
      is_marked_for_review: !!markedForReview[currentQ.id],
    }).catch((err) => {
      if (err?.message?.includes('Time expired') || err?.response?.data?.message?.includes('expired')) {
        handleFinalSubmit(true)
      }
    })
  }

  const handleClearAnswer = () => {
    if (!attemptData || !attemptData.questions || submitting || (timeLeftSeconds !== null && timeLeftSeconds <= 0)) return
    const currentQ = attemptData.questions[currentIndex]
    if (!currentQ) return

    const newAns = { ...answers }
    delete newAns[currentQ.id]
    setAnswers(newAns)

    const attId = attemptData.attempt_id || attemptData.id || ''
    attemptService.saveAnswer({
      attempt_id: attId,
      attemptId: attId,
      question_id: currentQ.id,
      questionId: currentQ.id,
      selected_answer: null,
      selectedOption: null,
      is_marked_for_review: !!markedForReview[currentQ.id],
    }).catch((err) => {
      if (err?.message?.includes('Time expired') || err?.response?.data?.message?.includes('expired')) {
        handleFinalSubmit(true)
      }
    })
  }


  const handleToggleMarkReview = () => {
    if (!attemptData || !attemptData.questions) return
    const currentQ = attemptData.questions[currentIndex]
    if (!currentQ) return

    const newMarked = { ...markedForReview, [currentQ.id]: !markedForReview[currentQ.id] }
    setMarkedForReview(newMarked)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-300">Initializing Exam Session & Questions...</p>
        </div>
      </div>
    )
  }

  if (error || !attemptData) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 text-center space-y-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Assessment Error</h2>
          <p className="text-xs text-slate-400">{error || 'Unable to start assessment session.'}</p>
          <button
            onClick={() => navigate('/student/assessments')}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors inline-flex items-center gap-2"
          >
            Return to Assessments
          </button>
        </div>
      </div>
    )
  }

  const questions = attemptData.questions || []
  const currentQ = questions[currentIndex]
  const totalQuestions = questions.length

  const answeredCount = Object.keys(answers).length
  const unansweredCount = totalQuestions - answeredCount
  const reviewCount = Object.values(markedForReview).filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col select-none">
      <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-8 py-3.5 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center border border-slate-700 shadow-xs">
              <img src="/logo.png" alt="SkillsetrA" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-xs sm:max-w-md">
                {attemptData.assessmentTitle || attemptData.assessment?.title || 'Placement Assessment'}
              </h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Proctored Assessment</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-extrabold text-sm sm:text-base transition-colors ${
                (timeLeftSeconds || 0) < 300
                  ? 'bg-rose-950/80 border-rose-700 text-rose-400 animate-pulse'
                  : 'bg-slate-900 border-slate-700 text-indigo-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{timeLeftSeconds !== null ? formatTime(timeLeftSeconds) : '--:--'}</span>
            </div>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Test</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col justify-between space-y-6 bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-xl">
          {currentQ ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-xl bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 font-extrabold text-xs">
                    Question {currentIndex + 1} of {totalQuestions}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${
                      currentQ.section === 'aptitude'
                        ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                        : 'bg-teal-950/60 border-teal-700/60 text-teal-300'
                    }`}
                  >
                    {currentQ.section === 'aptitude' ? (
                      <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> Aptitude</span>
                    ) : (
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Verbal</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Marks: <strong className="text-white">{currentQ.marks || 1}</strong></span>
                </div>
              </div>

              <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed pt-2">
                {currentQ.question_text}
              </div>

              <div className="space-y-3 pt-4">
                {(['A', 'B', 'C', 'D'] as QuestionOption[]).map((opt) => {
                  const key = `option_${opt.toLowerCase()}` as keyof ExamQuestion
                  const optionText = currentQ[key] as string
                  const isSelected = answers[currentQ.id] === opt

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption(opt)}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-950'
                          : 'bg-slate-900/70 border-slate-700/80 text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-xs flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {opt}
                      </span>
                      <span className="text-sm font-medium pt-1.5">{optionText}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">No question data available.</div>
          )}

          <div className="pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMarkReview}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  markedForReview[currentQ?.id]
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{markedForReview[currentQ?.id] ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>

              {answers[currentQ?.id] && (
                <button
                  onClick={handleClearAnswer}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-rose-400 hover:bg-rose-950/40 border border-slate-700 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Clear Response</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold hover:bg-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                disabled={currentIndex === totalQuestions - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="inline-flex items-center gap-1 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-40 transition-all cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Question Palette Navigator</h3>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-700 border border-slate-600"></span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span>Marked Review</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-400"></span>
                <span>Current</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1 pt-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex
                const isAnswered = !!answers[q.id]
                const isMarked = !!markedForReview[q.id]

                let btnStyle = 'bg-slate-900 border-slate-700 text-slate-400'
                if (isMarked) {
                  btnStyle = 'bg-amber-600 text-white font-bold border-amber-500'
                } else if (isAnswered) {
                  btnStyle = 'bg-emerald-600 text-white font-bold border-emerald-500'
                }

                if (isCurrent) {
                  btnStyle += ' ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-800'
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl border text-xs font-bold transition-all ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Submit Assessment</span>
            </button>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 max-w-md w-full rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-white">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-8 h-8" />
              <h2 className="text-xl font-bold text-white">Confirm Final Submission</h2>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to finish your assessment? Once submitted, your test will be evaluated and responses cannot be changed.
            </p>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Total Questions:</span>
                <strong className="text-white">{totalQuestions}</strong>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Answered:</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Unanswered:</span>
                <strong>{unansweredCount}</strong>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Marked for Review:</span>
                <strong>{reviewCount}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={submitting}
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={() => handleFinalSubmit(false)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {autoSubmittedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 max-w-md w-full rounded-3xl p-8 space-y-4 shadow-2xl text-center text-white">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white">Time Expired!</h2>
            <p className="text-xs text-slate-300">
              Time expired. Your test has been automatically submitted.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 text-indigo-400 text-xs font-semibold">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Generating your evaluation report...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

