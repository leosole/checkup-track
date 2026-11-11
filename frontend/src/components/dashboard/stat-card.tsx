import { Card } from "../ui/badge";
import type { DashboardStatCardProps } from "./types";

export function StatCard({ label, value, hint, tone }: DashboardStatCardProps) {
  const dot =
    tone === "danger"
      ? "bg-rose-500"
      : tone === "success"
        ? "bg-emerald-500"
        : tone === "brand"
          ? "bg-brand-500"
          : "bg-gray-400";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </Card>
  );
}
