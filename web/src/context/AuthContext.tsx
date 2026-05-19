import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  login as apiLogin,
  signup as apiSignup,
  type AuthResponse,
} from "../api/client";

interface User {
  id: number;
  email: string;
  accountHolderId: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseStoredUser(): User | null {
  try {
    const raw = localStorage.getItem("auth_user");
    if (raw) return JSON.parse(raw) as User;
  } catch {
    // ignore
  }
  return null;
}

function handleAuthResponse(response: AuthResponse): {
  token: string;
  user: User;
} {
  const { token, user } = response;
  localStorage.setItem("auth_token", token);
  localStorage.setItem("auth_user", JSON.stringify(user));
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("auth_token")
  );
  const [user, setUserState] = useState<User | null>(() =>
    parseStoredUser()
  );

  const isAuthenticated = !!token;

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const result = handleAuthResponse(response);
    setToken(result.token);
    setUserState(result.user);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const response = await apiSignup(email, password);
    const result = handleAuthResponse(response);
    setToken(result.token);
    setUserState(result.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((updatedUser: User) => {
    localStorage.setItem("auth_user", JSON.stringify(updatedUser));
    setUserState(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated, login, signup, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
