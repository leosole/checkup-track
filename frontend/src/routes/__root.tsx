import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { use_auth } from "../auth-context";
import { SignInView } from "../components/sign-in-view";
import { Spinner } from "../components/ui/badge";

function Root() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, loading } = use_auth();

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

  return user ? <Outlet /> : <SignInView />;
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