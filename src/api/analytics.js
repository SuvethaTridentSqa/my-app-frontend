// import api from './api'

// export const getUrlAnalytics = (slug) => api.get(`/urls/${slug}/analytics`)
// export const getUserAnalytics = () => api.get('/analytics/user')
// export const getGeoAnalytics = (id) => api.get(`/analytics/geo/${id}`)
// export const getHeatmap = (id) => api.get(`/analytics/heatmap/${id}`)

import api from "./api";

// export const getUrlAnalytics = (slug) =>
//     api.get(`/analytics/url/${encodeURIComponent(slug)}`)
export const getUrlAnalytics = (search) =>
  api.get("/analytics/url", {
    params: {
      search,
    },
  });
export const getDashboardAnalytics = () => api.get("/analytics/dashboard"); // export const getGeoAnalytics = (slug) => api.get(`/analytics/url/${slug}`);
export const getGeoAnalytics = (slug) => api.get(`/urls/${slug}/analytics`);

export const getUserAnalytics = () => api.get("/analytics/user");

// export const getGeoAnalytics = (id) =>
//     api.get(`/analytics/geo/${id}`)

export const getHeatmap = (id) => api.get(`/analytics/heatmap/${id}`);
