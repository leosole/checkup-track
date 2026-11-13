import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api, getGuestToken, setGuestToken } from "../api-client";
import { AnalyticsChart } from "../components/analytics-chart";
import {
  GUEST_MERGED_SPECS_KEY,
  GUEST_SELECTED_SPECS_KEY,
  usePlotMarkers,
} from "../components/analytics-chart/marker-selection";
import { formatTimestamp } from "../components/guest/format";
import { CodeEntry } from "../components/guest/code-entry";
import { ExamsSection } from "../components/guest/exams-section";
import { MedicationsSection } from "../components/guest/medications-section";
import { SymptomsSection } from "../components/guest/symptoms-section";
import { Logo } from "../components/logo";
import { Badge, Spinner } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import type { GuestShareData } from "../types";

/** Public, read-only screen reached through /guest with a one-time code. */
function GuestPage() {
  const [signed_in, set_signed_in] = useState(() => Boolean(getGuestToken()));
  const [data, set_data] = useState<GuestShareData | null>(null);
  const [loading, set_loading] = useState(false);
  const [code, set_code] = useState("");
  const [error, set_error] = useState<string | null>(null);
  const [submitting, set_submitting] = useState(false);
  const { selected: plot_markers, toggle: toggle_plot_marker } =
    usePlotMarkers(GUEST_SELECTED_SPECS_KEY);

  useEffect(() => {
    if (!signed_in) return;
    let active = true;
    set_loading(true);
    void api
      .guestData()
      .then((payload) => {
        if (!active) return;
        set_data(payload);
        set_error(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setGuestToken(null);
        set_signed_in(false);
        set_data(null);
        set_error(
          err instanceof Error
            ? err.message
            : "Could not open this shared view.",
        );
      })
      .finally(() => {
        if (active) set_loading(false);
      });
    return () => {
      active = false;
    };
  }, [signed_in]);

  function toggleMarker(name: string) {
    const available_names =
      data?.exams.flatMap((exam) =>
        exam.biomarkers.map((biomarker) => biomarker.biomarker_name),
      ) ?? [];
    toggle_plot_marker(name, available_names);
  }

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    set_submitting(true);
    set_error(null);
    try {
      const response = await api.redeemShareCode(value);
      setGuestToken(response.access_token);
      set_code("");
      set_signed_in(true);
    } catch (err) {
      set_error(
        err instanceof Error ? err.message : "Could not open that share code.",
      );
    } finally {
      set_submitting(false);
    }
  }

  function exit() {
    if (
      !window.confirm(
        "Exit this shared view? The code is single use, so you cannot open it again — the owner would need to share a new code.",
      )
    ) {
      return;
    }
    setGuestToken(null);
    set_signed_in(false);
    set_data(null);
    set_error(null);
  }

  async function openPdf(exam_id: number) {
    try {
      const blob = await api.guestExamPdf(exam_id);
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        set_error("The browser blocked the PDF tab. Allow pop-ups and retry.");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      set_error(err instanceof Error ? err.message : "Could not open the PDF.");
    }
  }

  if (!signed_in) {
    return (
      <CodeEntry
        code={code}
        error={error}
        submitting={submitting}
        on_code_change={set_code}
        on_submit={(event) => void redeem(event)}
      />
    );
  }

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo className="h-9 w-9 shrink-0 rounded-xl shadow-sm" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              CheckUpTrack
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Shared records
            </p>
          </div>
          <Badge tone="info" className="ml-auto">
            View only
          </Badge>
          <Button variant="secondary" size="sm" onClick={exit}>
            Exit
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Records shared by {data.share.owner_name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This view expires {formatTimestamp(data.share.expires_at)}. Shared
            records are read-only — nothing here can be edited or deleted.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        <ExamsSection
          exams={data.exams}
          plot_markers={plot_markers}
          on_toggle_marker={toggleMarker}
          on_open_pdf={(id) => void openPdf(id)}
        />

        <section>
          <AnalyticsChart
            exams={data.exams}
            selected={plot_markers}
            on_toggle_spec={toggleMarker}
            load_series={api.guestTimeSeries}
            merge_storage_key={GUEST_MERGED_SPECS_KEY}
          />
        </section>

        <MedicationsSection medications={data.medications} />

        <SymptomsSection symptoms={data.symptoms} />

        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          This is a read-only view. Nothing you do here changes the owner&apos;s
          records.
        </p>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/guest")({
  component: GuestPage,
});
