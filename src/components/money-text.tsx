import type { HTMLAttributes } from "react";

import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface MoneyTextProps extends HTMLAttributes<HTMLSpanElement> {
  cents: number;
  hideBalances?: boolean;
}

export function MoneyText({
  cents,
  hideBalances = false,
  className,
  ...props
}: MoneyTextProps) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {formatBRL(cents, hideBalances)}
    </span>
  );
}
