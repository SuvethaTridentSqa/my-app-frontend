import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const defaultAuth = {
    isAuthenticated: false,
    user: null,
    role: null,
}

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState(defaultAuth)

    useEffect(() => {
        const stored = window.localStorage.getItem('shortlyAuth')
        if (stored) {
            try {
                setAuth(JSON.parse(stored))
            } catch {
                window.localStorage.removeItem('shortlyAuth')
            }
        }
    }, [])

    useEffect(() => {
        if (auth.isAuthenticated) {
            window.localStorage.setItem('shortlyAuth', JSON.stringify(auth))
        } else {
            window.localStorage.removeItem('shortlyAuth')
        }
    }, [auth])

    const value = useMemo(
        () => ({
            auth,
            login: (user) => setAuth({ isAuthenticated: true, user, role: user.role || 'user' }),
            logout: () => setAuth(defaultAuth),
        }),
        [auth]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}
