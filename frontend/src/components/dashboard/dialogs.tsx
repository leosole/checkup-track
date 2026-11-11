import { notify } from "../ui/toast";
import { CalendarItemModal } from "../calendar-item-modal";
import { ExamRenameModal } from "../exam-rename-modal";
import { ManualExamModal } from "../manual-exam-modal";
import { MedicationModal } from "../medication-modal";
import { UploadExamModal } from "../upload-exam-modal";
import type { DashboardDialogsProps } from "./types";

/** All exam/medication dialogs owned by the dashboard layout. */
export function DashboardDialogs({
  dash,
  can_create_records,
  can_edit_results,
}: DashboardDialogsProps) {
  return (
    <>
      <UploadExamModal
        open={dash.upload_exam_open}
        on_close={() => dash.set_upload_exam_open(false)}
        on_saved={(saved) => {
          dash.set_upload_exam_open(false);
          notify.success(
            saved.processing
              ? `“${saved.title}” uploaded. Extraction queued.`
              : `“${saved.title}” saved without parsing.`,
          );
          void dash.refresh();
        }}
      />
      <MedicationModal
        open={
          dash.modal_open &&
          (dash.editing_med !== null || can_create_records)
        }
        med={dash.editing_med}
        onClose={() => {
          dash.set_modal_open(false);
          dash.set_editing_med(null);
        }}
        on_saved={() => void dash.refresh()}
      />
      <ExamRenameModal
        exam={dash.rename_modal_exam}
        on_close={() => dash.set_rename_modal_exam(null)}
        on_saved={dash.refresh}
      />
      <ManualExamModal
        exam={can_edit_results ? dash.manual_exam : null}
        on_close={dash.keepPdfOnly}
        on_keep_pdf={dash.keepPdfOnly}
        on_saved={(saved) => {
          dash.set_manual_exam(null);
          notify.success(`“${saved.title}” saved with manual results.`);
          void dash.refresh();
        }}
      />
      <CalendarItemModal
        item={dash.calendar_item}
        error={dash.calendar_item_error}
        busy={dash.calendar_action_busy}
        plot_markers={dash.plot_markers}
        on_toggle_marker={dash.toggleMarker}
        on_close={() => dash.set_calendar_item(null)}
        on_edit={dash.editCalendarItem}
        on_delete={() => void dash.deleteCalendarItem()}
        on_download={() => {
          if (dash.calendar_item?.kind === "exam") {
            void dash.downloadExamFile(dash.calendar_item.exam);
          }
        }}
        on_retry_exam={(id) => void dash.retryExam(id)}
        retry_error={dash.retry_error}
        retrying_exam_id={dash.retrying_exam_id}
      />
    </>
  );
}
