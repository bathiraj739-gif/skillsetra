import api from './api'

export interface ActivityLog {
  id?: string
  user_id: string
  role: 'student' | 'admin'
  activity_type: string
  description: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export const activityService = {
  async logActivity(payload: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    return {
      id: `act-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    }
  },

  async getStudentActivities(studentId: string): Promise<ActivityLog[]> {
    try {
      const res: any = await api.get('/admin/dashboard/activity')
      return (res?.data || []).filter((l: any) => l.user_id === studentId)
    } catch {
      return []
    }
  },

  async getAllActivities(): Promise<ActivityLog[]> {
    try {
      const res: any = await api.get('/admin/dashboard/activity')
      return res?.data || []
    } catch {
      return []
    }
  },
}
