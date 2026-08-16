import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonBadgeProps {
  current: number;
  previous: number;
  invert?: boolean;
  /** Short label like `+12%` with title tooltip for the full phrase. */
  compact?: boolean;
  className?: string;
}

export function ComparisonBadge({
  current,
  previous,
  invert = false,
  compact = false,
  className,
}: ComparisonBadgeProps) {
  if (previous === 0 && current === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground",
          className,
        )}
        title={compact ? "Sem variação vs período anterior" : undefined}
      >
        <Minus className="size-3" />
        {compact ? "—" : "Sem variação"}
      </span>
    );
  }

  const diff = current - previous;
  const pct =
    previous !== 0
      ? (diff / Math.abs(previous)) * 100
      : current > 0
        ? 100
        : 0;

  const improved = invert ? diff < 0 : diff > 0;
  const neutral = diff === 0;
  const absPct = Math.abs(pct).toFixed(0);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const fullLabel = `${absPct}% vs período anterior`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        neutral && "text-muted-foreground",
        !neutral && improved && "text-success",
        !neutral && !improved && "text-destructive",
        className,
      )}
      title={compact ? fullLabel : undefined}
    >
      {neutral ? (
        <Minus className="size-3" />
      ) : diff > 0 ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {compact
        ? neutral
          ? "—"
          : `${sign}${absPct}%`
        : fullLabel}
    </span>
  );
}
