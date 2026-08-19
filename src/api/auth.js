import api from './api'

export const login = (credentials) => api.post('/auth/login', credentials)
export const adminLogin = (credentials) => api.post('/auth/admin/login', credentials)
export const fetchCaptcha = () => api.get('/auth/captcha')
