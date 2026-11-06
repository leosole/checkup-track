import { createFileRoute } from "@tanstack/react-router";
import { GuestView } from "../components/guest-view";

function GuestRoute() {
  return <GuestView />;
}

export const Route = createFileRoute("/guest")({
  component: GuestRoute,
});
