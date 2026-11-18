import type { User } from "./user";

export interface AuthState {
  user: User | null;
  loading: boolean;
  google_configured: boolean;
  google_busy: boolean;
  test_user_enabled: boolean;
  auth_error: string | null;
  sign_in_with_google: () => void;
  sign_in_as_test_user: () => Promise<void>;
  sign_out: () => Promise<void>;
}
