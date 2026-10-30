import axios from "axios";

const apiOrigin =
  import.meta.env?.VITE_API_URL || "http://localhost:5000";
const baseURL = `${apiOrigin.replace(/\/+$/, "")}/api/v1`;

function unwrapApiEnvelope(response) {
  const envelope = response.data;
  if (
    !envelope ||
    typeof envelope !== "object" ||
    typeof envelope.success !== "boolean" ||
    typeof envelope.message !== "string" ||
    !Object.prototype.hasOwnProperty.call(envelope, "data") ||
    !Object.prototype.hasOwnProperty.call(envelope, "meta")
  ) {
    return response;
  }

  response.data = envelope.data;
  response.success = envelope.success;
  response.message = envelope.message;
  response.meta = envelope.meta;
  return response;
}

function normalizeApiError(error) {
  if (!error.response) {
    error.status = null;
    error.validationErrors = [];
    error.message = "Unable to reach the server. Please check your connection.";
    return error;
  }

  const response = error.response;
  const envelope = response.data;
  const backendMessage =
    typeof envelope?.message === "string" ? envelope.message : "";
  const validationErrors = Array.isArray(envelope?.meta?.errors)
    ? envelope.meta.errors
    : [];
  const validationMessage = validationErrors
    .map((validationError) => {
      if (typeof validationError === "string") return validationError;
      if (
        !validationError ||
        typeof validationError.message !== "string"
      ) {
        return "";
      }
      return typeof validationError.field === "string"
        ? `${validationError.field}: ${validationError.message}`
        : validationError.message;
    })
    .filter(Boolean)
    .join("; ");

  error.status = response.status;
  error.backendMessage = backendMessage;
  error.validationErrors = validationErrors;

  if (response.status >= 500) {
    response.data =
      envelope && typeof envelope === "object"
        ? {
            ...envelope,
            message: "The server could not complete the request. Please try again.",
          }
        : {
            message: "The server could not complete the request. Please try again.",
          };
    error.message = response.data.message;
  } else if (validationMessage) {
    const message = backendMessage
      ? `${backendMessage}: ${validationMessage}`
      : validationMessage;
    response.data =
      envelope && typeof envelope === "object"
        ? { ...envelope, message }
        : { message };
    error.message = message;
  } else if (backendMessage) {
    error.message = backendMessage;
  }

  return error;
}

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

refreshClient.interceptors.response.use(unwrapApiEnvelope, normalizeApiError);

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
  unwrapApiEnvelope,
  async (error) => {
    normalizeApiError(error);
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
