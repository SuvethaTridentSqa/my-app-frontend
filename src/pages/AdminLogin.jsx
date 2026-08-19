import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, fetchCaptcha } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

export default function AdminLogin() {
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaExpression, setCaptchaExpression] =
    useState("Loading captcha...");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCaptcha() {
      try {
        const response = await fetchCaptcha();
        setCaptchaId(response.data.id);
        setCaptchaExpression(response.data.expression || "Enter captcha");
      } catch {
        setCaptchaExpression("Unable to load captcha");
      }
    }
    loadCaptcha();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await adminLogin({
        email,
        password,
        captchaId,
        captchaAnswer,
      });
      const user = response.data.admin || { email, role: "admin" };
      const token = response.data.token;
      if (!token) {
        throw new Error("No authentication token returned by server");
      }
      setAuth(user, token);
      localStorage.setItem("user", JSON.stringify(user));
      // console.log("Admin login successful:", user)
      // console.log("====Token====:", token);
      navigate("/dashboard");
    } catch (err) {
      // console.error("Login Error:", err);
      console.error("Response:", err.response);
      // console.error("Data:", err.response?.data);
      setError(
        err.response?.data?.message || err.message || "Admin login failed.",
      );
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Admin access</h2>
        <p className="login-intro">
          Sign in with your admin credentials to view activity and audit logs.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="Enter admin email"
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Enter password"
            />
          </label>
          <label>
            Captcha: {captchaExpression} (-ve values is also allowed for few
            captcha answer)
            <input
              value={captchaAnswer}
              onChange={(event) => setCaptchaAnswer(event.target.value)}
              type="text"
              placeholder="Enter captcha answer"
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
