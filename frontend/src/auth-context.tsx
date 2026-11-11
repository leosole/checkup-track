import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken } from "./api-client";
import type { AuthProviderProps, AuthState, User } from "./types";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, set_user] = useState<User | null>(null);
  const [loading, set_loading] = useState(true);
  const [google_client_id, set_google_client_id] = useState<string | null>(
    null,
  );
  const [test_user_enabled, set_test_user_enabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await api.authConfig();
        if (!cancelled) {
          set_google_client_id(config.google_client_id);
          set_test_user_enabled(config.test_user_enabled);
        }
      } catch {
        if (!cancelled) set_google_client_id(null);
      }
      const token = getToken();
      if (token) {
        try {
          const profile = await api.me();
          if (!cancelled) set_user(profile);
        } catch {
          setToken(null);
          if (!cancelled) set_user(null);
        }
      }
      if (!cancelled) set_loading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithCredential = useCallback(async (credential: string) => {
    const res = await api.googleSignIn(credential);
    setToken(res.access_token);
    set_user(res.user);
  }, []);

  const signInAsTestUser = useCallback(async () => {
    const res = await api.testSignIn();
    setToken(res.access_token);
    set_user(res.user);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    set_user(null);
    if (
      typeof window !== "undefined" &&
      "google" in window &&
      (
        window as {
          google?: { accounts?: { id?: { disableAutoSelect?: () => void } } };
        }
      ).google?.accounts?.id?.disableAutoSelect
    ) {
      (
        window as unknown as {
          google: { accounts: { id: { disableAutoSelect: () => void } } };
        }
      ).google.accounts.id.disableAutoSelect();
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      google_client_id,
      test_user_enabled,
      signInWithCredential,
      signInAsTestUser,
      signOut,
    }),
    [
      user,
      loading,
      google_client_id,
      test_user_enabled,
      signInWithCredential,
      signInAsTestUser,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
