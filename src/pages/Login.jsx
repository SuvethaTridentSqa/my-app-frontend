import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, fetchCaptcha } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./Login.css";

export default function Login() {
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
        console.log("CAPTCHA RESPONSE:", response);
        setCaptchaId(response.id);
        setCaptchaExpression(response.expression || "Enter captcha");
      } catch (error) {
        console.error("CAPTCHA ERROR:", error);
        setCaptchaExpression("Unable to load captcha");
      }
    }
    loadCaptcha();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await login({
        email,
        password,
        captchaId,
        captchaAnswer,
      });
      const user = response.data.user || { email, role: "user" };
      const token = response.data.token;
      if (!user) {
        throw new Error("No user returned by server");
      }
      if (!token) {
        throw new Error("No authentication token returned by server");
      }
      setAuth(user, token);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Check your credentials.",
      );
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Welcome back</h2>
        <p className="login-intro">
          Sign in to manage your shortcuts and analytics.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="Enter email"
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
            {captchaExpression}
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
