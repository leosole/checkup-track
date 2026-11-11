import type { ReactNode } from "react";
import type { User } from "./user";

export interface AuthState {
  user: User | null;
  loading: boolean;
  google_client_id: string | null;
  test_user_enabled: boolean;
  signInWithCredential: (credential: string) => Promise<void>;
  signInAsTestUser: () => Promise<void>;
  signOut: () => void;
}

export interface AuthProviderProps {
  children: ReactNode;
}
