import api from './api'

export const authService = {
  async adminLogin(username: string, password: string) {
    const res: any = await api.post('/auth/admin/login', {
      username,
      password,
    })
    const token = res?.data?.token || res?.token
    if (token) {
      localStorage.setItem('accessToken', token)
      localStorage.setItem('token', token)
      localStorage.setItem('auth_token', token)
    }
    return res
  },

  async studentLogin(username: string, password: string) {
    const res: any = await api.post('/auth/student/login', {
      username,
      password,
    })
    const token = res?.data?.token || res?.token
    if (token) {
      localStorage.setItem('accessToken', token)
      localStorage.setItem('token', token)
      localStorage.setItem('auth_token', token)
    }
    return res
  },

  async getCurrentUser() {
    const res: any = await api.get('/auth/me')
    return res?.data?.user || res?.data || res?.user
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {}
    localStorage.removeItem('accessToken')
    localStorage.removeItem('token')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth0_access_token')
  },

  async changePassword(payload: { oldPassword: string; newPassword: string; confirmPassword?: string }) {
    const res: any = await api.post('/auth/change-password', payload)
    return res?.data || res
  },
}

export default authService
