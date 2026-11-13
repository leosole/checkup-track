import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../ui/button";
import { SELECT_CLASS } from "./share-utils";
import type { GroupTitleProps } from "./types";

/** Editable name of one share group, with an inline rename form. */
export function GroupTitle({ title, saving, on_save }: GroupTitleProps) {
  const [editing, set_editing] = useState(false);
  const [draft, set_draft] = useState(title ?? "");

  function startEditing() {
    set_draft(title ?? "");
    set_editing(true);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    on_save(next ? next : null);
    set_editing(false);
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft}
          maxLength={120}
          aria-label="Share group name"
          placeholder="e.g. Cardiologist visit"
          onChange={(event) => set_draft(event.target.value)}
          className={`${SELECT_CLASS} w-56`}
        />
        <Button size="sm" type="submit" loading={saving}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => set_editing(false)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
        {title ?? "Untitled group"}
      </p>
      <button
        type="button"
        onClick={startEditing}
        className="text-xs font-semibold text-brand-700 transition hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
      >
        {title ? "Rename" : "Name group"}
      </button>
    </div>
  );
}
