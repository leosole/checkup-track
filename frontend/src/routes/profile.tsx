import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "../components/dashboard-view/dashboard-view";

export const Route = createFileRoute("/profile")({
  component: DashboardView,
});