import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./Sidebar.css";
import {
  HiHome,
  HiScissors,
  HiChartBar,
  HiQrCode,
  HiLink,
  HiLockClosed,
  HiGlobeAlt,
  HiWrenchScrewdriver,
  HiCheckBadge,
  HiHandRaised,
  HiBars3,
  HiBars3BottomLeft,
} from "react-icons/hi2";

const links = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: <HiHome />,
  },
  {
    to: "/dashboard/shorten",
    label: "Shorten URL",
    icon: <HiScissors />,
  },
  {
    to: "/dashboard/analytics",
    label: "Analytics",
    icon: <HiChartBar />,
  },
  {
    to: "/dashboard/qr",
    label: "QR Code",
    icon: <HiQrCode />,
  },
  {
    to: "/dashboard/alias",
    label: "Custom Alias",
    icon: <HiLink />,
  },
  {
    to: "/dashboard/password",
    label: "Password Protection",
    icon: <HiLockClosed />,
  },
  {
    to: "/dashboard/geo",
    label: "Geo / Heatmap",
    icon: <HiGlobeAlt />,
  },
  {
    to: "/dashboard/admin",
    label: "Admin Activity",
    icon: <HiWrenchScrewdriver />,
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { auth } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const handleLogout = () => {
    logout();

    if (auth.role === "admin") {
      localStorage.removeItem("adminUser");
      navigate("/admin-login");
    } else {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-content" onClick={() => setCollapsed(!collapsed)}>
          <button className="menu-btn">
            {collapsed ? (
              <HiBars3 size={24} />
            ) : (
              <HiBars3BottomLeft size={24} />
            )}
          </button>

          {!collapsed && (
            <div className="brand-text">
              <h1>Shortly</h1>
              <p>URL Analytics Hub</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="sidebar-status-container">
            <div className="sidebar-status">
              {auth.isAuthenticated ? (
                <>
                  <span className="user-name">
                    {auth.user?.name || auth.user?.email}
                  </span>

                  <span className="user-role">{auth.role}</span>
                </>
              ) : (
                <>
                  <span className="user-name">Guest</span>
                  <span className="user-role">Not signed in</span>
                </>
              )}
            </div>

            {auth.isAuthenticated && (
              <button className="logout-btn" onClick={handleLogout}>
                <span className="tooltip">Logout</span>
                <LogOut size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {links
          .filter((link) => !link.adminOnly || auth.role === "admin")
          .map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <span className="nav-icon">{link.icon}</span>

              {!collapsed && <span className="nav-label">{link.label}</span>}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}
