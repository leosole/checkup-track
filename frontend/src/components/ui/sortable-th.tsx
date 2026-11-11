import { FaSortAmountDown, FaSortAmountDownAlt } from "react-icons/fa";
import type { SortableThProps } from "./types";

/** Clickable column header that toggles ascending/descending sorting. */
export function SortableTh<Field extends string>({
  field,
  sort,
  on_sort_change,
  className = "",
  children,
}: SortableThProps<Field>) {
  const active = sort.field === field;
  const SortedIcon =
    sort.direction === "asc" ? FaSortAmountDownAlt : FaSortAmountDown;

  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={className}
    >
      <button
        type="button"
        onClick={() => on_sort_change(field)}
        title={`Sort by ${typeof children === "string" ? children : "this column"}`}
        className={[
          "flex w-full items-center justify-between gap-2 px-4 py-3 text-left uppercase",
          "transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600",
          active
            ? "text-brand-700 dark:text-brand-300"
            : "text-gray-700 hover:text-brand-700 dark:text-gray-200 dark:hover:text-brand-300",
        ].join(" ")}
      >
        <span>{children}</span>
        {active && (
          <SortedIcon
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
            data-testid="sort-direction-icon"
          />
        )}
      </button>
    </th>
  );
}
