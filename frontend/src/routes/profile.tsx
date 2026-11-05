import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/dashboard-view/dashboard-view";
import { ProfileView } from "../components/profile-view";

function ProfileRoute() {
  return (
    <DashboardLayout route="/profile">
      {(content) => (
        <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <ProfileView on_back={content.on_back} />
        </main>
      )}
    </DashboardLayout>
  );
}

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});