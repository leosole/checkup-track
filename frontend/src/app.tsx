import { AuthProvider, use_auth } from "./auth-context";
import { DashboardView } from "./components/dashboard-view";
import { SignInView } from "./components/sign-in-view";
import { Spinner } from "./components/ui/badge";

function Root() {
  const { user, loading } = use_auth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return user ? <DashboardView /> : <SignInView />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
