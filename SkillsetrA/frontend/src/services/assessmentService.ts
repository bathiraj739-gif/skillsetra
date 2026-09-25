import api from './api'
import type { Assessment, AssessmentAssignment, Profile, Question } from '../types'

export const assessmentService = {
  async getAssessments(): Promise<Assessment[]> {
    const res: any = await api.get('/assessments')
    return (res?.data?.assessments || res?.data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      duration_minutes: a.duration_minutes || a.durationMinutes || 30,
      passing_percentage: a.passing_percentage || 50,
      status: a.status,
      aptitude_count: a.aptitude_count != null ? Number(a.aptitude_count) : (a.aptitudeCount != null ? Number(a.aptitudeCount) : 0),
      verbal_count: a.verbal_count != null ? Number(a.verbal_count) : (a.verbalCount != null ? Number(a.verbalCount) : 0),
      created_at: a.created_at,
      updated_at: a.updated_at,
    }))
  },

  async getAssessmentById(id: string): Promise<Assessment | null> {
    try {
      const res: any = await api.get(`/assessments/${id}`)
      const a = res?.data?.assessment || res?.data || res;
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        duration_minutes: a.duration_minutes || a.durationMinutes || 30,
        passing_percentage: a.passing_percentage || 50,
        status: a.status,
        aptitude_count: a.aptitude_count != null ? Number(a.aptitude_count) : (a.aptitudeCount != null ? Number(a.aptitudeCount) : 0),
        verbal_count: a.verbal_count != null ? Number(a.verbal_count) : (a.verbalCount != null ? Number(a.verbalCount) : 0),
        created_at: a.created_at,
        updated_at: a.updated_at,
      }
    } catch {
      return null
    }
  },

  async createAssessment(assessment: Omit<Assessment, 'id' | 'created_at' | 'updated_at'>): Promise<Assessment> {
    const res: any = await api.post('/assessments', assessment)
    const a = res?.data?.assessment || res?.data || res;
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      duration_minutes: a.duration_minutes,
      passing_percentage: a.passing_percentage,
      status: a.status,
      aptitude_count: a.aptitude_count != null ? Number(a.aptitude_count) : 0,
      verbal_count: a.verbal_count != null ? Number(a.verbal_count) : 0,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }
  },

  async updateAssessment(id: string, updates: Partial<Assessment>): Promise<Assessment> {
    const res: any = await api.put(`/assessments/${id}`, updates)
    const a = res?.data?.assessment || res?.data || res;
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      duration_minutes: a.duration_minutes,
      passing_percentage: a.passing_percentage,
      status: a.status,
      aptitude_count: a.aptitude_count != null ? Number(a.aptitude_count) : 0,
      verbal_count: a.verbal_count != null ? Number(a.verbal_count) : 0,
      created_at: a.created_at,
      updated_at: a.updated_at,
    }
  },

  async deleteAssessment(id: string): Promise<void> {
    await api.delete(`/assessments/${id}`)
  },

  async getAssessmentQuestions(assessmentId: string): Promise<Question[]> {
    try {
      const res: any = await api.get(`/assessments/${assessmentId}/questions`)
      const list = res?.data || res?.questions || (Array.isArray(res) ? res : [])
      return list.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        section: (q.category || q.section || 'aptitude').toLowerCase() as any,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_option || q.correct_answer || 'A',
        marks: q.marks || 1,
        difficulty: (q.difficulty || 'medium').toLowerCase(),
        is_active: true,
      }))
    } catch {
      const ass = await this.getAssessmentById(assessmentId)
      return (ass as any)?.questions || []
    }
  },

  async saveAssessmentQuestions(
    assessmentId: string,
    questionIds: string[],
    counts?: { aptitude_count: number; verbal_count: number }
  ) {
    await api.put(`/assessments/${assessmentId}`, {
      questionIds,
      aptitude_count: counts?.aptitude_count,
      verbal_count: counts?.verbal_count,
    })
  },

  async saveAssessmentWithQuestions(
    assessmentData: {
      id?: string
      title: string
      description?: string
      duration_minutes: number
      passing_percentage?: number
      status?: any
    },
    questionIds: string[]
  ): Promise<Assessment> {
    const payload = {
      title: assessmentData.title,
      description: assessmentData.description,
      durationMinutes: Number(assessmentData.duration_minutes),
      duration_minutes: Number(assessmentData.duration_minutes),
      passing_percentage: assessmentData.passing_percentage,
      status: (assessmentData.status || 'DRAFT').toUpperCase(),
      questionIds,
    }

    if (assessmentData.id) {
      const res: any = await api.put(`/assessments/${assessmentData.id}`, payload)
      return res?.data?.assessment || res?.data || res
    } else {
      const res: any = await api.post('/assessments', payload)
      return res?.data?.assessment || res?.data || res
    }
  },

  async getAssignedStudents(assessmentId: string): Promise<(AssessmentAssignment & { student: Profile })[]> {
    const res: any = await api.get(`/assignments?assessmentId=${assessmentId}`)
    return (res?.data?.assignments || res?.data || []).map((item: any) => {
      const studentObj = item.student || {}
      const studentName =
        studentObj.name ||
        studentObj.full_name ||
        studentObj.fullName ||
        item.candidate_name ||
        item.student_name ||
        item.full_name ||
        'Candidate'

      return {
        id: item.id,
        assessment_id: item.assessment_id || item.assessment?.id,
        student_id: item.student_id || studentObj.id,
        assigned_at: item.assigned_at,
        due_date: item.due_at || item.due_date,
        status: (item.status || 'assigned').toLowerCase(),
        student: {
          id: studentObj.id || item.student_id,
          name: studentName,
          full_name: studentName,
          email: studentObj.email || item.email,
          register_number: studentObj.register_number || studentObj.registerNumber || item.register_number || 'N/A',
          department: studentObj.department || item.department || '',
          year: studentObj.year || 4,
          section: studentObj.section || '',
          role: 'student',
        },
      }
    })
  },

  async assignAssessmentToStudents(assessmentId: string, studentIds: string[]) {
    const res: any = await api.post('/assignments', {
      assessmentId,
      studentIds,
    })
    return res?.data || res;
  },

  async assignToDepartment(assessmentId: string, department: string) {
    const res: any = await api.post('/assignments', {
      assessmentId,
      department,
    })
    return res.data
  },

  async assignToAllStudents(assessmentId: string) {
    const res: any = await api.post('/assignments', {
      assessmentId,
    })
    return res.data
  },
}
