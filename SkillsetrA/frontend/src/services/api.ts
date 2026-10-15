import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor: Automatically attach JWT access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// Response Interceptor: Exponential Backoff Retries on Transient Failures + Auth Management
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  async (error: AxiosError<any>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retryCount?: number }) | undefined
    const status = error.response?.status
    const message = (error.response?.data as any)?.message || error.message || 'API Request Failed'

    // 401 Unauthorized: Clear session tokens
    if (status === 401) {
      try {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('token')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth0_access_token')
      } catch (e) {
        // ignore
      }
      return Promise.reject(new Error(message))
    }

    // Do NOT retry client validation/auth errors
    if (status && status >= 400 && status < 500 && status !== 408) {
      return Promise.reject(new Error(message))
    }

    // Check if eligible for retry (Network error, 502, 503, 504, or 408)
    const isTransient = !status || [408, 502, 503, 504].includes(status) || error.code === 'ECONNABORTED'
    if (config && isTransient) {
      config._retryCount = config._retryCount || 0

      if (config._retryCount < 3) {
        config._retryCount += 1
        const delayMs = Math.min(300 * Math.pow(2, config._retryCount - 1), 2000)
        
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return api(config)
      }
    }

    return Promise.reject(new Error(message))
  }
)

export default api
