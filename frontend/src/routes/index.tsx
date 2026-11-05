import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/dashboard-view/dashboard-view";
import { DashboardOverview } from "../components/dashboard-view/overview";

function DashboardRoute() {
  return (
    <DashboardLayout route="/">
      {(content) => (
        <DashboardOverview
          data={content.overview_data}
          actions={content.overview_actions}
        />
      )}
    </DashboardLayout>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardRoute,
});