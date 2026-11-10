import { AuthProvider } from "./auth-context";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "./components/ui/toaster";
import { router } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  );
}
