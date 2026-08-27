import api from "./api";

export const login = (credentials) => api.post("/auth/login", credentials);

export const adminLogin = (credentials) =>
  api.post("/auth/admin/login", credentials);

export const fetchCaptcha = async () => {
  const response = await fetch("http://localhost:5000/api/auth/captcha");
  if (!response.ok) {
    throw new Error(`Captcha request failed: ${response.status}`);
  }
  return await response.json();
};
