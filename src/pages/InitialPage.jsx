import { Link } from "react-router-dom";

export default function InitialPage() {
  return (
    <div className="initial-page">
      <h1>Welcome</h1>

      <Link to="/login">
        <button>User Login</button>
      </Link>

      <Link to="/admin-login">
        <button>Admin Login</button>
      </Link>
    </div>
  );
}
