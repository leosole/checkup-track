import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as Google from "expo-auth-session/providers/google";
import { api, getToken, setToken } from "./api-client";
import type { AuthState } from "./types/auth";
import type { User } from "./types";

const AuthContext = createContext<AuthState | null>(null);

const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined;

// The Google provider throws while rendering when the client ID for the
// current platform is undefined. A placeholder keeps the sign-in screen (and
// the test-user option) usable before Google OAuth is configured; the Google
// button stays hidden while `google_configured` is false.
const UNCONFIGURED_CLIENT_ID = "unconfigured.apps.googleusercontent.com";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, set_user] = useState<User | null>(null);
  const [loading, set_loading] = useState(true);
  const [test_user_enabled, set_test_user_enabled] = useState(false);
  const [auth_error, set_auth_error] = useState<string | null>(null);

  const [request, response, prompt_async] = Google.useIdTokenAuthRequest({
    androidClientId: androidClientId ?? UNCONFIGURED_CLIENT_ID,
    iosClientId: iosClientId ?? UNCONFIGURED_CLIENT_ID,
    webClientId: webClientId ?? UNCONFIGURED_CLIENT_ID,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await api.authConfig();
        if (!cancelled) set_test_user_enabled(config.test_user_enabled);
      } catch {
        // Offline or unconfigured backend: sign-in options still render.
      }
      const token = await getToken();
      if (token) {
        try {
          const profile = await api.me();
          if (!cancelled) set_user(profile);
        } catch {
          await setToken(null);
          if (!cancelled) set_user(null);
        }
      }
      if (!cancelled) set_loading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") {
      set_auth_error(response.error?.message ?? "Google sign-in failed.");
      return;
    }
    if (response.type !== "success") return;

    const id_token =
      response.params.id_token ??
      response.params.idToken ??
      response.authentication?.idToken;
    if (!id_token) {
      set_auth_error("Google did not return an ID token. Try again.");
      return;
    }
    set_auth_error(null);
    (async () => {
      try {
        const res = await api.googleSignIn(id_token);
        await setToken(res.access_token);
        set_user(res.user);
      } catch (err) {
        set_auth_error(
          err instanceof Error ? err.message : "Sign-in failed on the server.",
        );
      }
    })();
  }, [response]);

  const sign_in_with_google = useCallback(() => {
    set_auth_error(null);
    void prompt_async();
  }, [prompt_async]);

  const sign_in_as_test_user = useCallback(async () => {
    set_auth_error(null);
    const res = await api.testSignIn();
    await setToken(res.access_token);
    set_user(res.user);
  }, []);

  const sign_out = useCallback(async () => {
    await setToken(null);
    set_user(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      google_configured: Boolean(androidClientId || iosClientId || webClientId),
      google_busy: !request,
      test_user_enabled,
      auth_error,
      sign_in_with_google,
      sign_in_as_test_user,
      sign_out,
    }),
    [
      user,
      loading,
      request,
      test_user_enabled,
      auth_error,
      sign_in_with_google,
      sign_in_as_test_user,
      sign_out,
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
