import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/dashboard-view/dashboard-view";
import { ShareView } from "../components/share-view";
import { Spinner } from "../components/ui/badge";

function ShareRoute() {
  return (
    <DashboardLayout route="/share">
      {(content) => (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {content.loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <ShareView
              exams={content.exams.exams}
              medications={content.medications.medications}
              on_back={content.on_back}
            />
          )}
        </main>
      )}
    </DashboardLayout>
  );
}

export const Route = createFileRoute("/share")({
  component: ShareRoute,
});
