import api from './api'

// export const getAdminUsers = () => api.get('/admin/users')
// export const getAdminActivity = () => api.get('/admin/activity')
export const getUsageHistory = () => api.get('/admin/usage-history')


export const getActivityLogs = () =>
    api.get('/admin/activity')


export const getAdminUsers = () =>
    api.get('/admin/users')


export const getAdminUsage = () =>
    api.get('/admin/usage')

