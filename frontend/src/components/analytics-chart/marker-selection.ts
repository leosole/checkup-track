import { useCallback, useEffect, useState } from "react";

/** localStorage key for the markers a signed-in user last plotted. */
const SELECTED_SPECS_KEY = "vitals.trends.markers";

/** Guests keep their own selection so it never mixes with an owner session. */
export const GUEST_SELECTED_SPECS_KEY = "vitals.guest.trends.markers";

export const MERGED_SPECS_KEY = "vitals.trends.merged";
export const GUEST_MERGED_SPECS_KEY = "vitals.guest.trends.merged";

/** Marker identity used by the backend: case- and surrounding-space-insensitive. */
export function marker_key(spec: string): string {
  return spec.trim().toLowerCase();
}

export function has_marker(specs: string[], spec: string): boolean {
  const key = marker_key(spec);
  return specs.some((name) => marker_key(name) === key);
}

/** Keeps the first spelling of each marker so variants are not listed twice. */
export function unique_specs(specs: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const spec of specs) {
    const key = marker_key(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(spec.trim());
  }
  return unique;
}

function read_saved_specs(storage_key: string): string[] {
  try {
    const raw = localStorage.getItem(storage_key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? unique_specs(
          parsed.filter((value): value is string => typeof value === "string"),
        )
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

  const toggle = useCallback(
    (spec: string, available_specs: string[] = [spec]) => {
      const normalized_spec = marker_key(spec);
      const matching_specs = available_specs.filter((name) =>
        marker_key(name).includes(normalized_spec),
      );
      const candidates = matching_specs.length > 0 ? matching_specs : [spec];

      set_selected((prev) => {
        if (prev.some((name) => marker_key(name) === normalized_spec)) {
          return prev.filter((name) => marker_key(name) !== normalized_spec);
        }
        return unique_specs([...prev, ...candidates]);
      });
    },
    [],
  );

  return { selected, toggle };
}
