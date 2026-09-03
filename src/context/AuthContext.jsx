import { createContext, useContext, useEffect, useMemo, useState } from "react";
const AuthContext = createContext(null);
const defaultAuth = {
  isAuthenticated: false,
  user: null,
  role: null,
  token: null,
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(defaultAuth);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("shortlyAuth");
    if (stored) {
      try {
        const parsedAuth = JSON.parse(stored);
        if (parsedAuth?.token) {
          setAuth({
            isAuthenticated: true,
            user: parsedAuth.user || null,
            role: parsedAuth.role || parsedAuth.user?.role || "user",
            token: parsedAuth.token,
          });
        } else {
          localStorage.removeItem("shortlyAuth");
        }
      } catch (error) {
        console.error("[AUTH] Failed to restore auth:", error);
        localStorage.removeItem("shortlyAuth");
      }
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (auth.isAuthenticated && auth.token) {
      localStorage.setItem("shortlyAuth", JSON.stringify(auth));
    }
  }, [auth]);

  const value = useMemo(
    () => ({
      auth,
      loading,
      login: (user, token) => {
        if (!token || typeof token !== "string") {
          console.error("[AUTH] login() called without valid token string", {
            tokenType: typeof token,
          });
          return;
        }
        const newAuth = {
          isAuthenticated: true,
          user: user || null,
          role: user?.role || "user",
          token: token,
        };
        // console.log("[AUTH] Setting authentication:", {
        //   isAuthenticated: newAuth.isAuthenticated,
        //   user: newAuth.user,
        //   role: newAuth.role,
        //   hasToken: !!newAuth.token,
        // });
        setAuth(newAuth);
        localStorage.setItem("shortlyAuth", JSON.stringify(newAuth));
      },
      logout: () => {
        setAuth(defaultAuth);
        localStorage.removeItem("shortlyAuth");
      },
    }),
    [auth, loading],
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
