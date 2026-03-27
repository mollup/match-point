import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, setStoredToken, type AuthUser } from "./api";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    role: "organizer" | "player";
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "mp_token";
const USER_KEY = "mp_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        try {
          const parsedUser = JSON.parse(u) as AuthUser;
          setToken(t);
          setUser(parsedUser);

          // If backend memory was reset, cached sessions can point to missing users.
          // Clear only this known-stale case so UI redirects to a clean login/register flow.
          try {
            await api.getUser(parsedUser.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg === "User not found") {
              if (!cancelled) {
                setToken(null);
                setUser(null);
              }
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              setStoredToken(null);
            }
          }
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setStoredToken(null);
        }
      }
      if (!cancelled) setReady(true);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback((t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setStoredToken(t);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      persistSession(res.token, res.user);
    },
    [persistSession]
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      role: "organizer" | "player";
    }) => {
      const res = await api.register(input);
      persistSession(res.token, res.user);
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setStoredToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login,
      register,
      logout,
    }),
    [user, token, ready, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
