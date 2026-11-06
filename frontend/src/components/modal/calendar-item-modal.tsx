import type { Exam, Medication } from "../../api-client";
import { use_auth } from "../../auth-context";
import { format_date } from "../../date-utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";

export type CalendarSelection =
  { kind: "exam"; exam: Exam } | { kind: "medication"; medication: Medication };

export function CalendarItemModal({
  item,
  error,
  busy,
  plot_markers,
  on_toggle_marker,
  on_close,
  on_edit,
  on_delete,
  on_download,
}: {
  item: CalendarSelection | null;
  error: string | null;
  busy: boolean;
  plot_markers: string[];
  on_toggle_marker: (name: string) => void;
  on_close: () => void;
  on_edit: () => void;
  on_delete: () => void;
  on_download: () => void;
}) {
  const { user } = use_auth();
  const is_exam = item?.kind === "exam";
  const title =
    item?.kind === "exam"
      ? item.exam.title
      : item?.kind === "medication"
        ? item.medication.name
        : "Calendar item";
  const medication_is_active =
    item?.kind === "medication" &&
    item.medication.start_date <= new Date().toISOString().slice(0, 10) &&
    (!item.medication.end_date ||
      item.medication.end_date >= new Date().toISOString().slice(0, 10));

  return (
    <Modal
      open={item !== null}
      title={title}
      subtitle={is_exam ? "Exam details" : "Medication details"}
      onClose={on_close}
      footer={
        item && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={on_edit}
            >
              Edit
            </Button>
            {is_exam && (
              <Button
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={on_download}
              >
                Download PDF
              </Button>
            )}
            {user?.capabilities.delete_records && (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={on_delete}
              >
                Delete
              </Button>
            )}
          </div>
        )
      }
    >
      {item?.kind === "exam" ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Performed
              </dt>
              <dd className="mt-1 text-gray-900 dark:text-white">
                {format_date(item.exam.date_performed)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Biomarkers
              </dt>
              <dd className="mt-1 text-gray-900 dark:text-white">
                {item.exam.biomarkers.length} total
              </dd>
            </div>
          </dl>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Results
              </h3>
              <Badge
                tone={
                  item.exam.biomarkers.some(
                    (biomarker) => biomarker.is_abnormal,
                  )
                    ? "danger"
                    : "success"
                }
              >
                {
                  item.exam.biomarkers.filter(
                    (biomarker) => biomarker.is_abnormal,
                  ).length
                }{" "}
                out of range
              </Badge>
            </div>
            {item.exam.biomarkers.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No biomarkers extracted.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
                  Click a result to add it to the trend plot.
                </p>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                  {item.exam.biomarkers.map((biomarker) => {
                    const plotted = plot_markers.includes(
                      biomarker.biomarker_name,
                    );
                    return (
                      <li key={biomarker.id}>
                        <button
                          type="button"
                          onClick={() =>
                            on_toggle_marker(biomarker.biomarker_name)
                          }
                          aria-pressed={plotted}
                          aria-label={`${biomarker.biomarker_name}: ${biomarker.value} ${
                            biomarker.unit
                          }. ${plotted ? "Remove from trend plot" : "Add to trend plot"}`}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 dark:hover:bg-gray-800/60"
                        >
                          <span className="flex min-w-0 items-center gap-2">
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
                            <span
                              className={[
                                "min-w-0 truncate",
                                biomarker.is_abnormal
                                  ? "text-rose-700 dark:text-rose-300"
                                  : "text-gray-700 dark:text-gray-300",
                              ].join(" ")}
                            >
                              {biomarker.biomarker_name}
                            </span>
                          </span>
                          <span
                            className={[
                              "shrink-0",
                              biomarker.is_abnormal
                                ? "font-semibold text-rose-700 dark:text-rose-300"
                                : "font-medium text-gray-900 dark:text-white",
                            ].join(" ")}
                          >
                            {biomarker.value} {biomarker.unit}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : item?.kind === "medication" ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Status
            </dt>
            <dd className="mt-1">
              <Badge tone={medication_is_active ? "success" : "gray"}>
                {medication_is_active ? "Active" : "Inactive"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Dosage
            </dt>
            <dd className="mt-1 text-gray-900 dark:text-white">
              {item.medication.dosage}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Frequency
            </dt>
            <dd className="mt-1 text-gray-900 dark:text-white">
              {item.medication.frequency_per_day} per day
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Starts
            </dt>
            <dd className="mt-1 text-gray-900 dark:text-white">
              {format_date(item.medication.start_date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Ends
            </dt>
            <dd className="mt-1 text-gray-900 dark:text-white">
              {item.medication.end_date
                ? format_date(item.medication.end_date)
                : "Ongoing"}
            </dd>
          </div>
        </dl>
      ) : null}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      )}
    </Modal>
  );
}
