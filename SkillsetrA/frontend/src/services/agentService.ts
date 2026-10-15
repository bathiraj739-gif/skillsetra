import api from './api'

export interface AgentResponseData {
  status: 'COMPLETED' | 'WAITING_FOR_CONFIRMATION' | 'WAITING_FOR_INPUT' | 'FAILED' | 'CANCELLED'
  intent?: string
  explanation?: string
  aiMessage: string
  data?: any
  preview?: any
  confirmationId?: string
  expiresAt?: number
  fileDetails?: any
}

export const agentService = {
  async sendAgentMessage(message: string): Promise<AgentResponseData> {
    const res = await api.post<any, any>('/agent/chat', { message })
    return res.data
  },

  async uploadAgentFile(file: File, fileCategory: 'QUESTIONS' | 'CANDIDATES' = 'QUESTIONS'): Promise<AgentResponseData> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileCategory', fileCategory)

    const res = await api.post<any, any>('/agent/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data
  },

  async sendAgentVoice(text: string): Promise<AgentResponseData> {
    const res = await api.post<any, any>('/agent/voice', { text })
    return res.data
  },

  async confirmAgentAction(confirmationId: string): Promise<AgentResponseData> {
    const res = await api.post<any, any>('/agent/confirm', { confirmationId })
    return res.data
  },

  async cancelAgentAction(confirmationId: string): Promise<AgentResponseData> {
    const res = await api.post<any, any>('/agent/cancel', { confirmationId })
    return res.data
  },

  async webImportQuestions(payload: {
    url?: string
    query?: string
    pastedText?: string
    count?: number
    category?: string
    difficulty?: string
  }): Promise<AgentResponseData> {
    const res = await api.post<any, any>('/agent/web-import', payload)
    return res.data
  },

  async getAgentHistory(): Promise<{ history: any[] }> {
    const res = await api.get<any, any>('/agent/history')
    return res.data
  },
}
