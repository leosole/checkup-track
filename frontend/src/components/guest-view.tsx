import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  api,
  get_guest_token,
  set_guest_token,
  type GuestShareData,
} from "../api-client";
import { format_date } from "../date-utils";
import { Badge, Card, EmptyState, Spinner } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Logo } from "./logo";

function format_timestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Public, read-only screen reached through /guest with a one-time code. */
export function GuestView() {
  const [signed_in, set_signed_in] = useState(() => Boolean(get_guest_token()));
  const [data, set_data] = useState<GuestShareData | null>(null);
  const [loading, set_loading] = useState(false);
  const [code, set_code] = useState("");
  const [error, set_error] = useState<string | null>(null);
  const [submitting, set_submitting] = useState(false);

  const load = useCallback(async () => {
    set_loading(true);
    try {
      const payload = await api.guest_data();
      set_data(payload);
      set_error(null);
    } catch (err) {
      set_guest_token(null);
      set_signed_in(false);
      set_data(null);
      set_error(
        err instanceof Error ? err.message : "Could not open this shared view.",
      );
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => {
    if (signed_in) void load();
  }, [signed_in, load]);

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    set_submitting(true);
    set_error(null);
    try {
      const response = await api.redeem_share_code(value);
      set_guest_token(response.access_token);
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
    set_guest_token(null);
    set_signed_in(false);
    set_data(null);
    set_error(null);
  }

  async function open_pdf(exam_id: number) {
    try {
      const blob = await api.guest_exam_pdf(exam_id);
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-brand-50/40 to-gray-100 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-untitled-lg ring-1 ring-gray-900/5 dark:bg-gray-900 dark:shadow-none dark:ring-white/10">
            <div className="flex flex-col items-center text-center">
              <Logo className="h-12 w-12 rounded-2xl shadow-sm" />
              <h1 className="mt-5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                View shared records
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Enter the one-time code you received. You will be able to view the
                shared exams and medications, but not change anything.
              </p>
            </div>

            <form className="mt-7 space-y-3" onSubmit={(event) => void redeem(event)}>
              <Input
                label="Share code"
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                onChange={(event) => set_code(event.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                loading={submitting}
                disabled={!code.trim()}
              >
                Open shared records
              </Button>
            </form>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {error}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Codes are single use. Ask the owner for a new one if this one expired.
            </p>
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
              Owner?{" "}
              <Link
                to="/"
                className="font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">Shared records</p>
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
            This view expires {format_timestamp(data.share.expires_at)}. Shared
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

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Exams ({data.exams.length})
          </h2>
          {data.exams.length === 0 ? (
            <EmptyState
              title="No exams shared"
              hint="The owner did not include any lab reports in this code."
            />
          ) : (
            <div className="space-y-4">
              {data.exams.map((exam) => (
                <Card key={exam.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {exam.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {format_date(exam.date_performed)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void open_pdf(exam.id)}
                    >
                      Open PDF
                    </Button>
                  </div>

                  {exam.biomarkers.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      No parsed results for this exam.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
                            <th scope="col" className="px-2 py-2">
                              Biomarker
                            </th>
                            <th scope="col" className="px-2 py-2">
                              Value
                            </th>
                            <th scope="col" className="px-2 py-2">
                              Reference
                            </th>
                            <th scope="col" className="px-2 py-2">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {exam.biomarkers.map((biomarker) => (
                            <tr key={biomarker.id}>
                              <th
                                scope="row"
                                className="px-2 py-2 font-medium text-gray-900 dark:text-white"
                              >
                                {biomarker.biomarker_name}
                              </th>
                              <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-300">
                                {biomarker.value} {biomarker.unit}
                              </td>
                              <td className="px-2 py-2 text-gray-600 dark:text-gray-300">
                                {biomarker.reference_range || "—"}
                              </td>
                              <td className="px-2 py-2">
                                <Badge
                                  tone={biomarker.is_abnormal ? "danger" : "success"}
                                >
                                  {biomarker.is_abnormal ? "Out of range" : "In range"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
            Medications ({data.medications.length})
          </h2>
          {data.medications.length === 0 ? (
            <EmptyState
              title="No medications shared"
              hint="The owner did not include any medications in this code."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th scope="col" className="px-4 py-3">
                      Medication
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Dosage
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Frequency
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Dates
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.medications.map((medication) => (
                    <tr key={medication.id}>
                      <th
                        scope="row"
                        className="px-4 py-3 font-medium text-gray-900 dark:text-white"
                      >
                        {medication.name}
                      </th>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {medication.dosage}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {medication.frequency_per_day}x per day
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-300">
                        {format_date(medication.start_date)} -{" "}
                        {medication.end_date
                          ? format_date(medication.end_date)
                          : "Ongoing"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          This is a read-only view. Nothing you do here changes the owner&apos;s
          records.
        </p>
      </main>
    </div>
  );
}
