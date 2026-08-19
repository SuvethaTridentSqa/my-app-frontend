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
        if (parsedAuth.token) {
          setAuth({
            isAuthenticated: true,
            user: parsedAuth.user || null,
            role: parsedAuth.role || parsedAuth.user?.role || "user",
            token: parsedAuth.token || null,
          });
        }
      } catch (error) {
        console.error("Failed to restore auth:", error);
        // localStorage.removeItem("shortlyAuth");
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (auth.isAuthenticated && auth.token) {
      localStorage.setItem("shortlyAuth", JSON.stringify(auth));
    } else {
      localStorage.removeItem("shortlyAuth");
    }
  }, [auth]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      localStorage.setItem(
        "shortlyAuth",
        JSON.stringify({
          isAuthenticated: true,
          user: auth.user,
          role: auth.role,
          token: null,
        }),
      );
    } else {
      localStorage.removeItem("shortlyAuth");
    }
  }, [auth]);

  const value = useMemo(
    () => ({
      auth,
      loading,
      login: (user, token) => {
        const tokenString = typeof token === "object" ? token.token : token;
        const newAuth = {
          isAuthenticated: true,
          user,
          role: user?.role || "user",
          token: tokenString,
        };
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
