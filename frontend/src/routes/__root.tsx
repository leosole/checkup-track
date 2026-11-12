import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useAuth } from "../auth-context";
import { SignIn } from "../components/sign-in";
import { Spinner } from "../components/ui/badge";
import { DashboardHeader } from "../components/dashboard/header";
import { DashboardDialogs } from "../components/dashboard/dialogs";
import {
  DashboardProvider,
  useDashboardState,
} from "../components/dashboard/provider";

/** Signed-in chrome: header, the active page, and the shared dialogs. */
function DashboardFrame() {
  const { user, signOut } = useAuth();
  const dash = useDashboardState();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardHeader
        user={user}
        theme={dash.theme}
        on_navigate={(next_route) => void navigate({ to: next_route })}
        on_toggle_theme={dash.toggleTheme}
        on_sign_out={signOut}
      />

      <Outlet />

      <DashboardDialogs
        dash={dash}
        can_create_records={Boolean(user?.capabilities.create_records)}
        can_edit_results={Boolean(user?.capabilities.edit_results)}
      />
    </div>
  );
}

function Root() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading } = useAuth();

  // Legal pages and the guest share screen are reachable without an account.
  if (
    pathname === "/guest" ||
    pathname === "/privacy-policy" ||
    pathname === "/terms-of-service"
  ) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) return <SignIn />;

  return (
    <DashboardProvider>
      <DashboardFrame />
    </DashboardProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-200">
      <p>Page not found.</p>
      <Link to="/" className="font-medium text-brand-700 dark:text-brand-300">
        Go to dashboard
      </Link>
    </div>
  );
}

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
});
