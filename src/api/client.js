// api/client.js

import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  // const token = localStorage.getItem("token");
  const token = localStorage.getItem("shortlyAuth")
    ? JSON.parse(localStorage.getItem("shortlyAuth")).user?.token
    : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
