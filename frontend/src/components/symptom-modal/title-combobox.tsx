import { useState } from "react";
import { Input } from "../ui/input";
import type { TitleComboboxProps } from "./types";

/** Title input that suggests the symptoms already on file. */
export function TitleCombobox({ value, titles, onChange }: TitleComboboxProps) {
  const [open, set_open] = useState(false);
  const query = value.trim().toLowerCase();
  const matches = titles
    .filter((title) => !query || title.toLowerCase().includes(query))
    .slice(0, 6);
  const is_new = query.length > 0 && !titles.some((title) => title.toLowerCase() === query);

  return (
    <div className="relative">
      <Input
        label="Symptom"
        placeholder="e.g., Headache"
        value={value}
        autoComplete="off"
        required
        onChange={(event) => {
          onChange(event.target.value);
          set_open(true);
        }}
        onFocus={() => set_open(true)}
        onBlur={() => window.setTimeout(() => set_open(false), 120)}
      />
      {open && (matches.length > 0 || is_new) && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg bg-white py-1 shadow-untitled-lg ring-1 ring-gray-900/10 dark:bg-gray-900 dark:ring-white/10">
          {matches.map((title) => (
            <li key={title}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(title);
                  set_open(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {title}
              </button>
            </li>
          ))}
          {is_new && (
            <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              New symptom — it will be added when you save.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
