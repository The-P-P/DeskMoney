import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction } from "@/domain/types";
import { monthRange, previousMonthRange, resolveReportRange } from "@/lib/dates";

export type StatementPeriod = "THIS_MONTH" | "LAST_3M" | "ALL";

export const PERIOD_PILLS: { value: StatementPeriod; label: string }[] = [
  { value: "THIS_MONTH", label: "Este mês" },
  { value: "LAST_3M", label: "3 meses" },
  { value: "ALL", label: "Tudo" },
];

export function resolveStatementRange(period: StatementPeriod): {
  start?: string;
  end?: string;
} {
  if (period === "ALL") return {};
  const range = resolveReportRange(period);
  return { start: range.start, end: range.end };
}

function previousThreeMonthsRange(): { start: string; end: string } {
  const now = new Date();
  const endMonth = subMonths(now, 3);
  const startMonth = subMonths(now, 5);
  const { start } = monthRange(startMonth);
  const { end } = monthRange(endMonth);
  return { start, end };
}

export function resolvePreviousRange(period: StatementPeriod): {
  start: string;
  end: string;
} | null {
  if (period === "THIS_MONTH") return previousMonthRange();
  if (period === "LAST_3M") return previousThreeMonthsRange();
  return null;
}

export function sumAmounts(txs: Transaction[]): number {
  return txs.reduce((s, t) => s + t.amount, 0);
}

export function groupByMonth(txs: Transaction[]): {
  key: string;
  label: string;
  total: number;
  income: number;
  expense: number;
  items: Transaction[];
}[] {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    const key = tx.date.slice(0, 7);
    const list = map.get(key) ?? [];
    list.push(tx);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const income = items
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amount, 0);
      const expense = items
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0);
      return {
        key,
        label: format(parseISO(`${key}-01`), "MMMM yyyy", { locale: ptBR }),
        total: sumAmounts(items),
        income,
        expense,
        items,
      };
    });
}

/** Signed delta for balance: income +, expense −, transfer 0 (legacy). */
export function transactionDelta(tx: Transaction): number {
  if (tx.type === "INCOME") return tx.amount;
  if (tx.type === "EXPENSE") return -tx.amount;
  return 0;
}

/**
 * Running balance after each transaction, keyed by tx id.
 * Uses the full history (chronological) so filtered views still show
 * absolute balances that match the current account balance.
 */
export function runningBalances(
  allTxs: Transaction[],
  initialBalance: number,
): Map<string, number> {
  const chronological = [...allTxs].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.createdAt.localeCompare(b.createdAt);
  });
  const map = new Map<string, number>();
  let balance = initialBalance;
  for (const tx of chronological) {
    balance += transactionDelta(tx);
    map.set(tx.id, balance);
  }
  return map;
}
