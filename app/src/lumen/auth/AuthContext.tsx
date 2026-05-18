import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api } from "@/lib/api/index.js";
import { setTokens, clearTokens, setUnauthorizedHandler } from "@/lib/api/client.js";
import type { MeResponse } from "@/lib/api/index.js";

interface AuthContextValue {
  user: MeResponse | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (tenantName: string, name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    const token = localStorage.getItem("aicfo.accessToken");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.auth.me();
      setUser(me);
    } catch {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearTokens();
      setUser(null);
      window.location.href = "/auth";
    });
    hydrate();
  }, [hydrate]);

  const signIn = async (email: string, password: string) => {
    const tokens = await api.auth.login({ email, password });
    setTokens(tokens!.accessToken, tokens!.refreshToken);
    const me = await api.auth.me();
    setUser(me);
  };

  const signUp = async (tenantName: string, name: string, email: string, password: string) => {
    const tokens = await api.auth.register({ tenantName, name, email, password });
    setTokens(tokens!.accessToken, tokens!.refreshToken);
    const me = await api.auth.me();
    setUser(me);
  };

  const signOut = async () => {
    const refreshToken = localStorage.getItem("aicfo.refreshToken") ?? "";
    try {
      await api.auth.logout(refreshToken);
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const requestPasswordReset = async (email: string) => {
    await api.auth.requestPasswordReset(email);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
