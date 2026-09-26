import api from './api'
import type { Result } from '../types'

function formatResult(r: any): Result {
  if (!r) return r
  const score = r.score != null ? Number(r.score) : (r.total_score != null ? Number(r.total_score) : 0)
  const totalQuestions = r.total_questions != null ? Number(r.total_questions) : (r.total_marks != null ? Number(r.total_marks) : (r.totalMarks || 0))
  const correct = r.correct_answers != null ? Number(r.correct_answers) : (r.correctAnswers != null ? Number(r.correctAnswers) : 0)
  const incorrect = r.incorrect_answers != null ? Number(r.incorrect_answers) : (r.wrong_answers != null ? Number(r.wrong_answers) : (r.wrongAnswers != null ? Number(r.wrongAnswers) : 0))
  const unanswered = r.unanswered != null ? Number(r.unanswered) : Math.max(0, totalQuestions - (correct + incorrect))
  const timeTaken = r.time_taken_seconds != null ? Number(r.time_taken_seconds) : (r.timeTakenSeconds != null ? Number(r.timeTakenSeconds) : 0)
  const percentage = r.percentage != null ? Number(r.percentage) : (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0)

  return {
    id: r.id,
    attempt_id: r.attempt_id || r.attemptId,
    student_id: r.student_id || r.studentId,
    assessment_id: r.assessment_id || r.assessmentId,
    score,
    total_score: score,
    total_marks: totalQuestions,
    total_questions: totalQuestions,
    percentage,
    aptitude_score: r.aptitude_score != null ? Number(r.aptitude_score) : (r.aptitudeScore != null ? Number(r.aptitudeScore) : 0),
    verbal_score: r.verbal_score != null ? Number(r.verbal_score) : (r.verbalScore != null ? Number(r.verbalScore) : 0),
    correct_answers: correct,
    incorrect_answers: incorrect,
    wrong_answers: incorrect,
    unanswered,
    time_taken_seconds: timeTaken,
    completed_at: r.completed_at || r.completedAt || r.created_at,
    submitted_at: r.submitted_at || r.completed_at || r.created_at,
    created_at: r.created_at || r.completed_at,
    assessment: {
      id: r.assessment?.id || r.assessment_id || r.assessmentId,
      title: r.assessment?.title || r.assessment_title || 'Placement Assessment',
      duration_minutes: r.assessment?.duration_minutes || r.duration_minutes || 30,
      passing_percentage: r.assessment?.passing_percentage || 50,
    } as any,
    student: {
      id: r.student?.id || r.student_id,
      name:
        r.student?.name ||
        r.student?.full_name ||
        r.student?.fullName ||
        r.full_name ||
        r.student_name ||
        r.candidate_name ||
        'Candidate',
      full_name:
        r.student?.full_name ||
        r.student?.fullName ||
        r.student?.name ||
        r.full_name ||
        r.student_name ||
        r.candidate_name,
      username: r.student?.username,
      register_number: r.student?.register_number || r.student?.registerNumber || r.register_number || 'N/A',
      department: r.student?.department || r.department || '',
    } as any,
    answer_report: Array.isArray(r.answer_report) ? r.answer_report : (Array.isArray(r.answerReport) ? r.answerReport : undefined),
  }
}


export const resultService = {
  async getAllResults(): Promise<Result[]> {
    const res: any = await api.get('/results')
    const list = res?.data?.results || res?.results || res?.data || []
    return (Array.isArray(list) ? list : []).map(formatResult)
  },

  async getMyResults(_studentId?: string): Promise<Result[]> {
    const res: any = await api.get('/student/results')
    const list = res?.data?.results || res?.results || res?.data || []
    return (Array.isArray(list) ? list : []).map(formatResult)
  },

  async getResultById(resultId: string): Promise<Result | null> {
    try {
      let res: any
      try {
        res = await api.get(`/student/results/${resultId}`)
      } catch {
        res = await api.get(`/results/${resultId}`)
      }
      const r = res?.data?.result || res?.data || res?.result || res
      if (!r) return null
      return formatResult(r)
    } catch {
      return null
    }
  },

  async getResultByAttemptId(attemptId: string): Promise<Result | null> {
    try {
      const res: any = await api.get(`/results/${attemptId}`)
      const r = res?.data?.result || res?.data || res?.result || res
      return r ? formatResult(r) : null
    } catch {
      return null
    }
  },

  async saveResult(result: Result): Promise<Result> {
    return result
  },
}
