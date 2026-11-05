import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/dashboard-view/dashboard-view";
import { ExamsView } from "../components/exams-view";
import { Spinner } from "../components/ui/badge";

function ExamsRoute() {
  return (
    <DashboardLayout route="/exams">
      {(content) => (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {content.loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
          ) : (
            <ExamsView {...content.exams} />
          )}
        </main>
      )}
    </DashboardLayout>
  );
}

export const Route = createFileRoute("/exams")({
  component: ExamsRoute,
});