import { AuthProvider } from "./auth-context";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
