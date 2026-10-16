import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { logoutSession, registerAuthCallbacks } from "../api/client.js";

const AuthContext = createContext(null);

const defaultAuth = {
  isAuthenticated: false,
  user: null,
  role: null,
  accessToken: null,
};

function readStoredAuth() {
  const stored = localStorage.getItem("shortlyAuth");
  if (!stored) return defaultAuth;

  try {
    const parsedAuth = JSON.parse(stored);
    const accessToken = parsedAuth?.accessToken || parsedAuth?.token;
    if (typeof accessToken !== "string" || !accessToken) {
      localStorage.removeItem("shortlyAuth");
      return defaultAuth;
    }

    const user = parsedAuth.user || null;
    return {
      isAuthenticated: true,
      user,
      role: parsedAuth.role || user?.role || "user",
      accessToken,
    };
  } catch (error) {
    console.error("[AUTH] Failed to restore auth:", error);
    localStorage.removeItem("shortlyAuth");
    return defaultAuth;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(readStoredAuth);
  const [logoutInProgress, setLogoutInProgress] = useState(false);
  const accessTokenRef = useRef(auth.accessToken);

  const updateAccessToken = useCallback((accessToken) => {
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("An access token is required.");
    }

    if (!accessTokenRef.current) return;
    accessTokenRef.current = accessToken;
    setAuth((currentAuth) => ({
      ...currentAuth,
      accessToken,
    }));
  }, []);

  const login = useCallback((user, accessToken) => {
    if (typeof accessToken !== "string" || !accessToken) {
      throw new Error("Login requires a valid access token.");
    }

    const nextAuth = {
      isAuthenticated: true,
      user: user || null,
      role: user?.role || "user",
      accessToken,
    };
    accessTokenRef.current = accessToken;
    setAuth(nextAuth);
  }, []);

  const clearAuth = useCallback(() => {
    accessTokenRef.current = null;
    setAuth(defaultAuth);
    localStorage.removeItem("shortlyAuth");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("adminUser");
  }, []);

  const handleUnauthorized = useCallback(() => {
    const loginPath = auth.role === "admin" ? "/admin-login" : "/login";
    clearAuth();
    navigate(loginPath, { replace: true, state: { expired: true } });
  }, [auth.role, clearAuth, navigate]);

  const logout = useCallback(async () => {
    setLogoutInProgress(true);
    clearAuth();
    try {
      await logoutSession();
    } finally {
      navigate("/select-login", { replace: true });
      setLogoutInProgress(false);
    }
  }, [clearAuth, navigate]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.accessToken) {
      localStorage.setItem("shortlyAuth", JSON.stringify(auth));
    } else {
      localStorage.removeItem("shortlyAuth");
    }
  }, [auth]);

  useLayoutEffect(
    () =>
      registerAuthCallbacks({
        getAccessToken: () => accessTokenRef.current,
        setAccessToken: updateAccessToken,
        onUnauthorized: handleUnauthorized,
      }),
    [handleUnauthorized, updateAccessToken],
  );

  const value = useMemo(
    () => ({
      auth,
      accessToken: auth.accessToken,
      user: auth.user,
      loading: false,
      logoutInProgress,
      login,
      logout,
    }),
    [auth, login, logout, logoutInProgress],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
