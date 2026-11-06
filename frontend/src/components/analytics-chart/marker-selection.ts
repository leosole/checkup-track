import { useCallback, useEffect, useState } from "react";

/** localStorage key for the markers a signed-in user last plotted. */
const SELECTED_SPECS_KEY = "vitals.trends.markers";

/** Guests keep their own selection so it never mixes with an owner session. */
export const GUEST_SELECTED_SPECS_KEY = "vitals.guest.trends.markers";

function read_saved_specs(storage_key: string): string[] {
  try {
    const raw = localStorage.getItem(storage_key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Marker names currently plotted in the trends chart. It lives above the exam
 * cards and the exam modal so clicking a result anywhere toggles its series.
 */
export function use_plot_markers(storage_key: string = SELECTED_SPECS_KEY) {
  const [selected, set_selected] = useState<string[]>(() =>
    read_saved_specs(storage_key),
  );

  // Remember the plotted markers so they come back on the next visit.
  useEffect(() => {
    try {
      localStorage.setItem(storage_key, JSON.stringify(selected));
    } catch {
      // Storage full or disabled: the selection simply is not persisted.
    }
  }, [selected, storage_key]);

  const toggle = useCallback((spec: string) => {
    set_selected((prev) =>
      prev.includes(spec) ? prev.filter((item) => item !== spec) : [...prev, spec],
    );
  }, []);

  return { selected, toggle };
}
