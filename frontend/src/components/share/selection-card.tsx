import { Card } from "../ui/badge";
import { CHECKBOX_CLASS, plural } from "./share-utils";
import type { SelectionCardProps } from "./types";

/** Selectable list of records to include in a share code. */
export function SelectionCard({
  title,
  unit,
  items,
  selected,
  all_selected,
  empty_hint,
  on_toggle,
  on_toggle_all,
}: SelectionCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {selected.size} of {plural(items.length, unit)} selected
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={on_toggle_all}
            className="text-xs font-semibold text-brand-700 hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
          >
            {all_selected ? "Clear" : "Select all"}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {empty_hint}
        </p>
      ) : (
        <ul className="mt-3 max-h-64 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selected.has(item.id)}
                  onChange={() => on_toggle(item.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {item.hint}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
