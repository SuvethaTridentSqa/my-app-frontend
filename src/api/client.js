import axios from "axios";

const baseURL = "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let authCallbacks = null;
let refreshPromise = null;

export function registerAuthCallbacks(callbacks) {
  authCallbacks = callbacks;
  return () => {
    if (authCallbacks === callbacks) {
      authCallbacks = null;
    }
  };
}

export function logoutSession() {
  return refreshClient.post("/auth/logout");
}

api.interceptors.request.use((config) => {
  const accessToken = authCallbacks?.getAccessToken();
  config.headers = config.headers || {};

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      /\/auth\/(?:login|admin\/login|refresh)(?:\?|$)/.test(requestUrl)
    ) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      authCallbacks?.onUnauthorized();
      return Promise.reject(error);
    }

    const callbacks = authCallbacks;
    const currentToken = callbacks?.getAccessToken();
    if (!callbacks || !currentToken) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const sentAuthorization =
        originalRequest.headers?.get?.("Authorization") ||
        originalRequest.headers?.Authorization;
      const sentToken = sentAuthorization?.replace(/^Bearer\s+/i, "");

      let accessToken = currentToken;
      if (!sentToken || sentToken === currentToken) {
        if (!refreshPromise) {
          refreshPromise = refreshClient
            .post("/auth/refresh")
            .then((response) => {
              const refreshedToken = response.data?.token;
              if (!refreshedToken) {
                throw new Error(
                  "Refresh response did not include an access token.",
                );
              }
              callbacks.setAccessToken(refreshedToken);
              return refreshedToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        accessToken = await refreshPromise;
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      callbacks.onUnauthorized();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
