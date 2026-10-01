import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, get_token, set_token, type User } from "./api-client";

interface AuthState {
  user: User | null;
  loading: boolean;
  google_client_id: string | null;
  sign_in_with_credential: (credential: string) => Promise<void>;
  sign_out: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, set_user] = useState<User | null>(null);
  const [loading, set_loading] = useState(true);
  const [google_client_id, set_google_client_id] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await api.auth_config();
        if (!cancelled) set_google_client_id(config.google_client_id);
      } catch {
        if (!cancelled) set_google_client_id(null);
      }
      const token = get_token();
      if (token) {
        try {
          const profile = await api.me();
          if (!cancelled) set_user(profile);
        } catch {
          set_token(null);
          if (!cancelled) set_user(null);
        }
      }
      if (!cancelled) set_loading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sign_in_with_credential = useCallback(async (credential: string) => {
    const res = await api.google_sign_in(credential);
    set_token(res.access_token);
    set_user(res.user);
  }, []);

  const sign_out = useCallback(() => {
    set_token(null);
    set_user(null);
    if (
      typeof window !== "undefined" &&
      "google" in window &&
      (window as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } })
        .google?.accounts?.id?.disableAutoSelect
    ) {
      (
        window as unknown as {
          google: { accounts: { id: { disableAutoSelect: () => void } } };
        }
      ).google.accounts.id.disableAutoSelect();
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, google_client_id, sign_in_with_credential, sign_out }),
    [user, loading, google_client_id, sign_in_with_credential, sign_out],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function use_auth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("use_auth must be used inside an AuthProvider");
  }
  return ctx;
}
