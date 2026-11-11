import type { SortDirection, SortState } from "./components/ui/types";

/**
 * Column-header sorting: the first click on a header sorts ascending, a
 * second click on the same header sorts descending. Switching columns starts
 * over ascending.
 */
export function toggleSort<Field extends string>(
  current: SortState<Field>,
  field: Field,
): SortState<Field> {
  const direction: SortDirection =
    current.field === field && current.direction === "asc" ? "desc" : "asc";
  return { field, direction };
}
