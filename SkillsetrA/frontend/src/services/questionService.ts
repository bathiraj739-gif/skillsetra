import api from './api'
import type { Question, QuestionSection } from '../types'

export const questionService = {
  async getQuestions(sectionFilter?: QuestionSection): Promise<Question[]> {
    const params: any = {}
    if (sectionFilter) {
      params.category = sectionFilter.toUpperCase()
    }

    const res: any = await api.get('/questions', { params })
    return (res?.data?.questions || res?.data || []).map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      section: (q.category || q.section || 'aptitude').toLowerCase() as QuestionSection,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_option || q.correct_answer || 'A',
      marks: 1,
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      is_active: true,
      created_at: q.created_at,
    }))
  },

  async createQuestion(question: Omit<Question, 'id' | 'created_at'>): Promise<Question> {
    const payload = {
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: (question.correct_answer || 'A').toUpperCase(),
      category: (question.section || 'APTITUDE').toUpperCase(),
      difficulty: (question.difficulty || 'MEDIUM').toUpperCase(),
      marks: question.marks != null ? Number(question.marks) : 1,
    }

    const res: any = await api.post('/questions', payload)
    const q = res?.data?.question || res?.data || res;
    return {
      id: q.id,
      question_text: q.question_text,
      section: (q.category || q.section || 'aptitude').toLowerCase() as QuestionSection,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_option || q.correct_answer || 'A',
      marks: q.marks != null ? Number(q.marks) : 1,
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      is_active: true,
      created_at: q.created_at,
    }
  },

  async updateQuestion(id: string, updates: Partial<Question>): Promise<Question> {
    const payload: any = {
      question_text: updates.question_text,
      option_a: updates.option_a,
      option_b: updates.option_b,
      option_c: updates.option_c,
      option_d: updates.option_d,
      correct_option: updates.correct_answer ? updates.correct_answer.toUpperCase() : undefined,
    }
    if (updates.section) {
      payload.category = updates.section.toUpperCase()
    }
    if (updates.difficulty) {
      payload.difficulty = updates.difficulty.toUpperCase()
    }
    if (updates.marks !== undefined) {
      payload.marks = Number(updates.marks)
    }

    const res: any = await api.put(`/questions/${id}`, payload)
    const q = res?.data?.question || res?.data || res;
    return {
      id: q.id,
      question_text: q.question_text,
      section: (q.category || q.section || 'aptitude').toLowerCase() as QuestionSection,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_option || q.correct_answer || 'A',
      marks: q.marks != null ? Number(q.marks) : 1,
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      is_active: true,
    }
  },

  async deleteQuestion(id: string): Promise<void> {
    await api.delete(`/questions/${id}`)
  },

  async toggleActive(_id: string, _active?: boolean): Promise<void> {
    // No-op for backend active flag
  },

  async batchImportQuestions(
    questions: Omit<Question, 'id' | 'created_at'>[]
  ): Promise<{ inserted: number; total: number; failed: number; successCount: number }> {
    let inserted = 0
    let failed = 0
    for (const q of questions) {
      try {
        await this.createQuestion(q)
        inserted++
      } catch (err) {
        console.error('Failed to create question in batch:', q.question_text, err)
        failed++
      }
    }
    return { inserted, total: questions.length, failed, successCount: inserted }
  },

  async createQuestionsBatch(
    questions: Omit<Question, 'id' | 'created_at'>[]
  ): Promise<{ inserted: number; total: number; failed: number; successCount: number }> {
    return this.batchImportQuestions(questions)
  },

  async importFromTxtFile(fileContent: string, defaultCategory: string = 'APTITUDE'): Promise<any> {
    const res: any = await api.post('/questions/import', {
      fileContent,
      defaultCategory: defaultCategory.toUpperCase(),
    })
    return res
  },
}
