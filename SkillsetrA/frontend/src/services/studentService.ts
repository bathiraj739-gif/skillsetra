import api from './api'
import type { Assessment, AssessmentAssignment, Profile } from '../types'

export const studentService = {
  async getAllStudents(): Promise<Profile[]> {
    const res: any = await api.get('/students')
    const list = res?.data?.students || res?.students || res?.data || []
    return list.map((s: any) => ({
      id: s.id,
      name: s.full_name || s.name,
      username: s.username,
      email: s.email,
      register_number: s.register_number || s.registerNumber,
      department: s.department,
      year: parseInt(s.year || s.yearOfStudy) || (typeof s.year === 'number' ? s.year : 4),
      year_of_study: s.year || s.yearOfStudy || `${s.year || 4}th Year`,
      role: 'student',
      created_at: s.created_at,
    }))
  },

  async getMyAssignedAssessments(_studentId?: string): Promise<(AssessmentAssignment & { assessment: Assessment })[]> {
    const res: any = await api.get('/student/assignments')
    const list = res?.data?.assignments || res?.data || res?.assignments || (Array.isArray(res) ? res : [])
    return list.map((item: any) => {
      const ass = item.assessment || {
        id: item.assessment_id || item.assessmentId,
        title: item.title,
        description: item.description,
        duration_minutes: item.duration_minutes || item.durationMinutes || 30,
        passing_percentage: item.passing_percentage || 50,
        status: item.assessment_status || 'published',
        aptitude_count: item.aptitude_count || 0,
        verbal_count: item.verbal_count || 0,
        created_at: item.assigned_at,
        updated_at: item.assigned_at,
      }
      return {
        id: item.id,
        assessment_id: item.assessment_id || item.assessmentId || ass.id,
        student_id: item.student_id,
        assigned_at: item.assigned_at,
        due_date: item.due_at || item.due_date,
        status: (item.status || 'assigned').toLowerCase(),
        assessment: {
          ...ass,
          id: ass.id || item.assessment_id || item.assessmentId,
          title: ass.title || item.title || 'Placement Assessment',
          description: ass.description || item.description,
          duration_minutes: ass.duration_minutes || ass.durationMinutes || 30,
          aptitude_count: ass.aptitude_count != null ? Number(ass.aptitude_count) : (item.aptitude_count || 0),
          verbal_count: ass.verbal_count != null ? Number(ass.verbal_count) : (item.verbal_count || 0),
          passing_percentage: ass.passing_percentage || 50,
          status: ass.status || 'published',
        },
      }
    })
  },

  async getProfile(userId: string): Promise<Profile> {
    try {
      const res: any = await api.get(`/students/${userId}`)
      const s = res?.data?.student || res?.student || res?.data || res
      return {
        id: s.id,
        name: s.full_name || s.name,
        username: s.username,
        email: s.email,
        register_number: s.register_number || s.registerNumber,
        department: s.department,
        year: parseInt(s.year || s.yearOfStudy) || 4,
        year_of_study: s.year || s.yearOfStudy || '4th Year',
        role: 'student',
      }
    } catch {
      return {
        id: userId,
        name: '',
        username: '',
        email: '',
        role: 'student',
      }
    }
  },

  async createStudent(student: {
    name: string
    username: string
    password?: string
    email?: string
    register_number: string
    department?: string
    year?: number
  }): Promise<Profile> {
    const payload = {
      username: student.username,
      password: student.password || 'password123',
      name: student.name,
      full_name: student.name,
      email: student.email || undefined,
      register_number: student.register_number,
      registerNumber: student.register_number,
      department: student.department,
      year: student.year,
      yearOfStudy: `${student.year || 4}th Year`,
    }

    const res: any = await api.post('/students', payload)
    const s = res?.data?.student || res?.student || res?.data || res
    return {
      id: s.id,
      name: s.full_name || s.name,
      username: s.username,
      email: s.email,
      register_number: s.register_number || s.registerNumber,
      department: s.department,
      year: parseInt(s.year || s.yearOfStudy) || (typeof s.year === 'number' ? s.year : 4),
      year_of_study: s.year || s.yearOfStudy || `${s.year || 4}th Year`,
      role: 'student',
      created_at: s.created_at,
    }
  },

  async createStudentProfile(student: any): Promise<Profile> {
    return this.createStudent(student)
  },

  async updateStudent(id: string, updates: Partial<Profile>): Promise<Profile> {
    const res: any = await api.put(`/students/${id}`, {
      name: updates.name,
      full_name: updates.name,
      email: updates.email,
      register_number: updates.register_number,
      registerNumber: updates.register_number,
      department: updates.department,
      year: updates.year,
      yearOfStudy: updates.year_of_study || `${updates.year || 4}th Year`,
    })
    const s = res?.data?.student || res?.student || res?.data || res
    return {
      id: s.id,
      name: s.full_name || s.name,
      username: s.username,
      email: s.email,
      register_number: s.register_number || s.registerNumber,
      department: s.department,
      year: parseInt(s.year || s.yearOfStudy) || 4,
      year_of_study: s.year || s.yearOfStudy || '4th Year',
      role: 'student',
    }
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    return this.updateStudent(id, updates)
  },

  async deleteStudent(id: string): Promise<void> {
    await api.delete(`/students/${id}`)
  },

  async deleteStudentProfile(id: string): Promise<void> {
    return this.deleteStudent(id)
  },
}
