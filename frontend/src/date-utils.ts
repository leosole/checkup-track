/** Small date helpers (ISO strings YYYY-MM-DD everywhere in the API). */

export function to_iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parse_iso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function add_days(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function add_months(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return copy;
}

export function start_of_month(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function end_of_month(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function is_same_day(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function format_date(iso: string): string {
  return parse_iso(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function format_month_label(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Six rows of seven cells covering the month of `cursor` (padded). */
export function month_grid(cursor: Date): Date[] {
  const first = start_of_month(cursor);
  const start = add_days(first, -first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push(add_days(start, i));
  }
  return cells;
}
