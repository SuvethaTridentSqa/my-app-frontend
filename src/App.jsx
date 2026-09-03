import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { socket } from "./lib/socket";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import UrlShortener from "./pages/UrlShortener";
import Analytics from "./pages/Analytics";
import QrGenerator from "./pages/QrGenerator";
import CustomAlias from "./pages/CustomAlias";
import PasswordProtection from "./pages/PasswordProtection";
import GeoHeatmap from "./pages/GeoHeatmap";
import AdminActivity from "./pages/AdminActivity";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import LinkVisualizer from "./pages/LinkVisualizer";
import Chat from "./pages/Chat";
import ProtectedRoute from "./pages/ProtectedRoutes";
import "./ai/transformersConfig";
import "./App.css";

function App() {
  useEffect(() => {
    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
    };
    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", socket.id, "Reason:", reason);
    };
    const handleConnectError = (error) => {
      console.error("Socket connection error:", error.message);
    };
    const handleTaskUpdated = (data) => {
      console.log("Task updated:", data);
    };
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("taskUpdated", handleTaskUpdated);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("taskUpdated", handleTaskUpdated);
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="shorten" element={<UrlShortener />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="chat" element={<Chat />} />
        <Route path="qr" element={<QrGenerator />} />
        <Route path="alias" element={<CustomAlias />} />
        <Route path="password" element={<PasswordProtection />} />
        <Route path="geo" element={<GeoHeatmap />} />
        <Route path="admin" element={<AdminActivity />} />
        <Route path="visualizer/links" element={<LinkVisualizer />} />
      </Route>
    </Routes>
  );
}

export default App;
