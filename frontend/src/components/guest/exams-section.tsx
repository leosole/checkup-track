import { useState } from "react";
import { formatDate } from "../../date-utils";
import { hasMarker } from "../analytics-chart/marker-selection";
import { Badge, Card, EmptyState } from "../ui/badge";
import { Button } from "../ui/button";
import type { ExamsSectionProps } from "./types";

/** Read-only list of shared exams with collapsible, selectable biomarkers. */
export function ExamsSection({
  exams,
  plot_markers,
  on_toggle_marker,
  on_open_pdf,
}: ExamsSectionProps) {
  const [open_exams, set_open_exams] = useState<Record<number, boolean>>({});

  function toggleExam(exam_id: number) {
    set_open_exams((current) => ({
      ...current,
      [exam_id]: !current[exam_id],
    }));
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        Exams ({exams.length})
      </h2>
      {exams.length > 0 && (
        <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
          Open an exam to see its biomarkers — click one to add it to the trend
          plot.
        </p>
      )}
      {exams.length === 0 ? (
        <EmptyState
          title="No exams shared"
          hint="The owner did not include any lab reports in this code."
        />
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const expanded = Boolean(open_exams[exam.id]);
            const panel_id = `guest-exam-panel-${exam.id}`;
            return (
              <Card key={exam.id} className="p-0">
                <div className="flex flex-wrap items-start justify-between gap-2 p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() => toggleExam(exam.id)}
                    aria-expanded={expanded}
                    aria-controls={panel_id}
                    className="flex min-w-0 items-center gap-2 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  >
                    <svg
                      className={[
                        "h-4 w-4 shrink-0 text-gray-400 transition-transform dark:text-gray-500",
                        expanded ? "rotate-180" : "",
                      ].join(" ")}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 7.22a.75.75 0 011.06 0L10 10.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.28a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {exam.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(exam.date_performed)}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge tone="gray">
                      {exam.biomarkers.length} result
                      {exam.biomarkers.length === 1 ? "" : "s"}
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => on_open_pdf(exam.id)}
                    >
                      Open PDF
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div
                    id={panel_id}
                    className="border-t border-gray-200 p-4 dark:border-gray-800 sm:p-5"
                  >
                    {exam.biomarkers.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No parsed results for this exam.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
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
                            {exam.biomarkers.map((biomarker) => {
                              const plotted = hasMarker(
                                plot_markers,
                                biomarker.biomarker_name,
                              );
                              return (
                                <tr key={biomarker.id}>
                                  <th
                                    scope="row"
                                    className="px-2 py-1.5 font-medium text-gray-900 dark:text-white"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        on_toggle_marker(
                                          biomarker.biomarker_name,
                                        )
                                      }
                                      aria-pressed={plotted}
                                      aria-label={`${
                                        biomarker.biomarker_name
                                      }: ${biomarker.value} ${biomarker.unit}. ${
                                        plotted
                                          ? "Remove from trend plot"
                                          : "Add to trend plot"
                                      }`}
                                      className="flex w-full items-center gap-2 rounded-md py-0.5 text-left transition hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:hover:text-brand-300"
                                    >
                                      <span
                                        aria-hidden="true"
                                        className={[
                                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                          plotted
                                            ? "border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500"
                                            : "border-gray-300 dark:border-gray-600",
                                        ].join(" ")}
                                      >
                                        {plotted && (
                                          <svg
                                            className="h-3 w-3"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 011.415-1.415L8.5 12.085l6.79-6.795a1 1 0 011.414 0z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        )}
                                      </span>
                                      <span className="min-w-0 truncate">
                                        {biomarker.biomarker_name}
                                      </span>
                                    </button>
                                  </th>
                                  <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-300">
                                    {biomarker.value} {biomarker.unit}
                                  </td>
                                  <td className="px-2 py-2 text-gray-600 dark:text-gray-300">
                                    {biomarker.reference_range || "—"}
                                  </td>
                                  <td className="px-2 py-2">
                                    <Badge
                                      tone={
                                        biomarker.is_abnormal
                                          ? "danger"
                                          : "success"
                                      }
                                    >
                                      {biomarker.is_abnormal
                                        ? "Out of range"
                                        : "In range"}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
