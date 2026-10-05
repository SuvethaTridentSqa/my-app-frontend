import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "./Layout.css";
import { useTheme } from "../context/ThemeContext";
import { MdDarkMode, MdLightMode } from "react-icons/md";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-button"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle dark mode"
    >
      {theme === "light" ? <MdDarkMode /> : <MdLightMode />}
    </button>
  );
}

export default function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <ThemeToggle />
        <Outlet />
      </main>
    </div>
  );
}
