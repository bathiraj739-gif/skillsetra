import api from './api'

export interface GenerateAiQuestionsPayload {
  category: 'APTITUDE' | 'VERBAL'
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  count: number
  marks: number
}

export interface GeneratedAiQuestion {
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: 'A' | 'B' | 'C' | 'D'
  explanation: string
  category: 'APTITUDE' | 'VERBAL'
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  marks: number
}

export const aiQuestionService = {
  async generateQuestions(payload: GenerateAiQuestionsPayload): Promise<GeneratedAiQuestion[]> {
    const res: any = await api.post('/ai/questions/generate', payload)
    return res?.data?.questions || res?.questions || []
  },
}
