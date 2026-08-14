import api from './api'

export const createUrl = (data) => api.post('/urls/', data)
export const listUrls = () => api.get('/urls/')
export const getUrl = (slug) => api.get(`/urls/${slug}`)
export const protectUrl = (slug, data) => api.post(`/urls/${slug}/check-password`, data)

export const getUrls = () =>
    api.get('/urls')
