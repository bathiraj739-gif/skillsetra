import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Automatically attach JWT access token
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch (err) {
      console.warn('Could not retrieve token for API request:', err)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: Handle 401 Unauthorized & API Errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || 'API Request Failed'

    if (status === 401) {
      // Remove tokens upon 401 Unauthorized
      localStorage.removeItem('accessToken')
      localStorage.removeItem('token')
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth0_access_token')
    }

    return Promise.reject(new Error(message))
  }
)

export default api
