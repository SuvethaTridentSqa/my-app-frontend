import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UsageBadge from "../components/UsageBadge";
import {
  HiHome,
  HiScissors,
  HiChartBar,
  HiQrCode,
  HiLink,
  HiLockClosed,
  HiGlobeAlt,
  HiUser,
  HiShieldCheck,
  HiChatBubbleLeftRight,
} from "react-icons/hi2";

const featureCards = [
  {
    title: "Shorten links",
    description: "Create shareable URLs instantly and track performance.",
    label: "Fast setup",
    icon: <HiScissors />,
  },
  {
    title: "Analytics dashboard",
    description: "Review click trends, device usage, and referrer data.",
    label: "Top metrics",
    icon: <HiChartBar />,
  },
  {
    title: "Password protection",
    description: "Secure links with passwords and trusted access only.",
    label: "Safe sharing",
    icon: <HiLockClosed />,
  },
  {
    title: "Custom aliases",
    description: "Brand URLs with your own alias, not a random slug.",
    label: "Brand-ready",
    icon: <HiLink />,
  },
  {
    title: "QR generator",
    description: "Create downloadable QR codes for shortened URLs.",
    label: "Easy share",
    icon: <HiQrCode />,
  },
  {
    title: "Geo traffic preview",
    description: "Browse regional traffic zones with a demo selector.",
    label: "Geo insights",
    icon: <HiGlobeAlt />,
  },
];

export default function Dashboard() {
  const [viewMode, setViewMode] = useState("grid");
  const navigate = useNavigate();
  // setviewMode('grid');
  return (
    <section className="page-content">
      <header className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Manage your shortened URLs, analytics, and security settings.</p>
        </div>
        <UsageBadge count={10} />
      </header>
      <div className="dashboard-toolbar">
        {/* <div className="dashboard-toggle">
                    <button
                        className={viewMode === 'grid' ? 'outline-button active' : 'outline-button'}
                        onClick={() => setViewMode('grid')}
                    >
                        Card view
                    </button>
                    <button
                        className={viewMode === 'list' ? 'outline-button active' : 'outline-button'}
                        onClick={() => setViewMode('list')}
                    >
                        List view
                    </button>
                </div> */}
        <div className="dashboard-actions">
          <button className="icon-link" onClick={() => navigate("/login")}>
            <HiUser /> User login
          </button>
          <button
            className="icon-link"
            onClick={() => navigate("/admin-login")}
          >
            <HiShieldCheck /> Admin login
          </button>
          <button
            className="icon-link"
            onClick={() => navigate("/dashboard/chat")}
          >
            <HiChatBubbleLeftRight /> AI Chat
          </button>
        </div>
      </div>
      <div className={`feature-grid ${viewMode}`}>
        {featureCards.map((feature) => (
          <article key={feature.title} className={`feature-card ${viewMode}`}>
            {/* <div className="feature-card-image" aria-hidden="true">
              <span>{feature.icon}</span>
            </div> */}
            <div className="feature-card-body">
              <span className="feature-tag">{feature.label}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
