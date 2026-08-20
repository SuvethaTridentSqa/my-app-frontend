import { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import UsageBadge from "../components/UsageBadge";
import { useAuth } from "../context/AuthContext.jsx";
import { getActivityLogs } from "../api/admin.js";

export default function AdminActivity() {
  const { auth } = useAuth();
  const [activityRecords, setActivityRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.role !== "admin") {
      return;
    }

    loadActivity();
  }, [auth.role]);

  const loadActivity = async () => {
    try {
      setLoading(true);
      const response = await getActivityLogs();
      setActivityRecords(response.data);
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to load activity.");
    } finally {
      setLoading(false);
    }
  };

  function formatUserName(name) {
    if (!name) return "Unknown";
    if (name === "Admin User") return "Admin";
    if (name === "User One") return "User";
    return name;
  }
  if (auth.role !== "admin") {
    return (
      <section className="page-content">
        <BackButton />
        <header className="page-header">
          <div>
            <h2>Admin Activity</h2>
            <p>Administrator access is required to view this page.</p>
          </div>
        </header>
        <div className="message-box warn">
          You must be logged in as an admin.
        </div>
      </section>
    );
  }

  return (
    <section className="page-content">
      <BackButton />
      <header className="page-header">
        <div>
          <h2>Admin Activity</h2>
          <p>Review user activity, logins, and feature usage.</p>
        </div>
        <UsageBadge count={activityRecords.length} />
      </header>
      {message && <div className="message-box warn">{message}</div>}
      <div className="admin-table">
        <div className="admin-row admin-header">
          <span>User</span>
          <span>Event</span>
          <span>When</span>
        </div>
        {loading ? (
          <div className="message-box">Loading activity...</div>
        ) : activityRecords.length === 0 ? (
          <div className="message-box">No activity found.</div>
        ) : (
          activityRecords.map((record) => (
            <div key={record._id} className="admin-row">
              <span>{formatUserName(record.user?.name || record.user)}</span>
              <span>{formatAction(record.action)}</span>
              <span>{new Date(record.createdAt).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function formatAction(action) {
  const actions = {
    create_short_url: "Created short URL",
    resolve_url: "Opened short URL",
    chat_with_ai: "Used AI Chat",
    update_password: "Updated password rule",
    view_analytics: "Viewed analytics",
    user_login: "User Logged In",
    admin_login: "Admin Logged In",
    user_logout: "User Logged Out",
    admin_logout: "Admin Logged Out",
    url_analytics: "URL Analytics Viewed",
    url_alias: "Used Short URL(URL Alias)",
  };

  return actions[action] || action;
}
