import api from './api'
import type { AnswerPayload, ExamQuestion, SavedAnswer, StartAttemptResponse } from '../types'

export const attemptService = {
  async startAttempt(assignmentOrAssessmentId: string): Promise<StartAttemptResponse> {
    const res: any = await api.post('/student/attempts', { 
      assignmentId: assignmentOrAssessmentId,
      assessmentId: assignmentOrAssessmentId 
    })
    const data = res?.data?.attempt || res?.data || res
    const attemptId = data.id || data.attempt_id

    // Fetch questions for this attempt session
    let questions: ExamQuestion[] = []
    let savedAnswers: SavedAnswer[] = []

    try {
      const qRes: any = await api.get(`/student/attempts/${attemptId}/questions`)
      const qList = qRes?.data?.questions || qRes?.data || (Array.isArray(qRes) ? qRes : [])
      questions = (Array.isArray(qList) ? qList : []).map((q: any, i: number) => {
        if (q.selected_option) {
          savedAnswers.push({
            question_id: q.id,
            questionId: q.id,
            selected_answer: q.selected_option,
            selectedOption: q.selected_option,
            is_marked_for_review: false,
          })
        }
        return {
          id: q.id,
          question_text: q.question_text,
          section: (q.category || q.section || 'aptitude').toLowerCase() as any,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: undefined,
          marks: q.marks || 1,
          difficulty: (q.difficulty || 'medium').toLowerCase() as any,
          order: q.question_order || i + 1,
        }
      })
    } catch (err) {
      console.error('Failed to load attempt questions:', err)
    }

    return {
      attempt_id: attemptId,
      attemptId: attemptId,
      id: attemptId,
      assessmentId: data.assessment_id || data.assessmentId,
      started_at: data.started_at,
      startedAt: data.started_at,
      status: (data.status || 'in_progress').toLowerCase(),
      assessment: data.assessment,
      questions: questions,
      saved_answers: savedAnswers,
    }
  },

  async getAttempt(attemptId: string) {
    const questionsRes: any = await api.get(`/student/attempts/${attemptId}/questions`);
    const qData = questionsRes?.data || questionsRes || [];
    
    // Simulate getting answers from somewhere (or if endpoint returns it, adapt here)
    // Actually the backend might not return savedAnswers in this endpoint, let's keep it empty for now.
    
    const questions: ExamQuestion[] = qData.map((q: any, i: number) => ({
      id: q.id,
      question_text: q.question_text,
      section: (q.category || 'aptitude').toLowerCase(),
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: undefined,
      marks: q.marks || 1,
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      order: i + 1,
    }))

    return {
      id: attemptId,
      attempt_id: attemptId,
      assessmentId: '',
      assessmentTitle: '',
      durationMinutes: 0,
      remainingSeconds: 0,
      startedAt: new Date().toISOString(),
      started_at: new Date().toISOString(),
      status: 'in_progress',
      questions: questions,
      answers: {},
      assessment: {
        id: '',
        title: '',
        description: '',
        duration_minutes: 0,
        aptitude_count: 0,
        verbal_count: 0,
        passing_percentage: 50,
        status: 'published',
      },
    }
  },

  async saveAnswer(payload: AnswerPayload): Promise<void> {
    const attId = payload.attempt_id || payload.attemptId
    const qId = payload.question_id || payload.questionId
    const sOpt = payload.selected_answer || payload.selectedOption

    if (!attId || !qId) return

    await api.post(`/student/attempts/${attId}/answers`, {
      questionId: qId,
      selectedOption: sOpt,
    })
  },

  async submitAttempt(attemptId: string): Promise<any> {
    const res: any = await api.post(`/student/attempts/${attemptId}/submit`)
    return res?.data?.result || res?.data || res;
  },

  async getLiveAttempts(): Promise<any[]> {
    try {
      const res: any = await api.get('/admin/activities')
      const list = res?.data?.data || res?.data || []
      return Array.isArray(list) ? list : (list.activities || [])
    } catch {
      try {
        const res2: any = await api.get('/admin/dashboard/activity')
        const list2 = res2?.data?.data || res2?.data || []
        return Array.isArray(list2) ? list2 : (list2.activities || [])
      } catch {
        return []
      }
    }
  },

  async getLiveMonitoringFeed(): Promise<{ activeSessions: any[]; activities: any[]; summary: any }> {
    try {
      const res: any = await api.get('/admin/monitoring/live')
      return res?.data?.data || res?.data || { activeSessions: [], activities: [], summary: {} }
    } catch {
      return { activeSessions: [], activities: [], summary: {} }
    }
  },
}
