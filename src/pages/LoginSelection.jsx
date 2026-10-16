import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function LoginSelection() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("user");

  function handleSubmit(event) {
    event.preventDefault();
    navigate(loginType === "admin" ? "/admin-login" : "/login");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Login</h2>
        <p className="login-intro">
          Shortly: choose how you would like to log in.
        </p>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Login
            <select
              value={loginType}
              onChange={(event) => setLoginType(event.target.value)}
            >
              <option value="user">Login as User</option>
              <option value="admin">Login as Admin</option>
            </select>
          </label>
          <button type="submit">Continue</button>
        </form>
      </div>
    </div>
  );
}
