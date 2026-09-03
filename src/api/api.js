import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    let token = null;
    const storedAuth = localStorage.getItem("shortlyAuth");
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        token = parsed?.token || null;
      } catch (error) {
        console.error("[API] Failed to parse stored authentication:", error);
        localStorage.removeItem("shortlyAuth");
      }
    }
    config.headers = config.headers || {};
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      // console.log(
      //   `[API] ${config.method?.toUpperCase()} ${config.url} -> Authorization attached`,
      // );
    } else {
      delete config.headers.Authorization;
      // console.warn(
      //   `[API] ${config.method?.toUpperCase()} ${config.url} -> WARNING: No authentication token found`,
      // );
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data;
    if (status === 401) {
      console.error("[API] 401 Unauthorized - Session expired", {
        url: error.config?.url,
        method: error.config?.method,
        message: errorData?.message,
      });
      localStorage.removeItem("shortlyAuth");
      window.dispatchEvent(
        new CustomEvent("auth:unauthorized", { detail: { error: errorData } }),
      );
    } else if (status === 403) {
      console.error("[API] 403 Forbidden - Access denied", {
        url: error.config?.url,
        method: error.config?.method,
        message: errorData?.message,
      });
    } else if (errorData?.message?.includes("authentication")) {
      console.error("[API] Authentication error detected", {
        url: error.config?.url,
        method: error.config?.method,
        status: status,
        message: errorData?.message,
      });
    }

    return Promise.reject(error);
  },
);

export default api;
