import api from "./api";

export const login = (credentials) => api.post("/auth/login", credentials);

export const adminLogin = (credentials) =>
  api.post("/auth/admin/login", credentials);

export const fetchCaptcha = async () => {
  try {
    const response = await api.get("/auth/captcha");
    return response.data;
  } catch (error) {
    console.error("[CAPTCHA] Failed to fetch captcha:", error);
    throw new Error(
      error?.response?.data?.message ||
        `Captcha request failed: ${error.response?.status || error.message}`,
    );
  }
};
