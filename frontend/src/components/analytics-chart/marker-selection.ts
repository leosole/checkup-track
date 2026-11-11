import { useCallback, useEffect, useState } from "react";

/** localStorage key for the markers a signed-in user last plotted. */
const SELECTED_SPECS_KEY = "vitals.trends.markers";

/** Guests keep their own selection so it never mixes with an owner session. */
export const GUEST_SELECTED_SPECS_KEY = "vitals.guest.trends.markers";

export const MERGED_SPECS_KEY = "vitals.trends.merged";
export const GUEST_MERGED_SPECS_KEY = "vitals.guest.trends.merged";

/** Marker identity used by the backend: case- and surrounding-space-insensitive. */
export function markerKey(spec: string): string {
  return spec.trim().toLowerCase();
}

export function hasMarker(specs: string[], spec: string): boolean {
  const key = markerKey(spec);
  return specs.some((name) => markerKey(name) === key);
}

/** Keeps the first spelling of each marker so variants are not listed twice. */
export function uniqueSpecs(specs: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const spec of specs) {
    const key = markerKey(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(spec.trim());
  }
  return unique;
}

function readSavedSpecs(storage_key: string): string[] {
  try {
    const raw = localStorage.getItem(storage_key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? uniqueSpecs(
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
export function usePlotMarkers(storage_key: string = SELECTED_SPECS_KEY) {
  const [selected, set_selected] = useState<string[]>(() =>
    readSavedSpecs(storage_key),
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
    (spec: string, availableSpecs: string[] = [spec]) => {
      const normalized_spec = markerKey(spec);
      const matching_specs = availableSpecs.filter((name) =>
        markerKey(name).includes(normalized_spec),
      );
      const candidates = matching_specs.length > 0 ? matching_specs : [spec];

      set_selected((prev) => {
        if (prev.some((name) => markerKey(name) === normalized_spec)) {
          return prev.filter((name) => markerKey(name) !== normalized_spec);
        }
        return uniqueSpecs([...prev, ...candidates]);
      });
    },
    [],
  );

  return { selected, toggle };
}
