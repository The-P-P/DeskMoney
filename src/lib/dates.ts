import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReportPeriod, RecurrenceFrequency } from "@/domain/types";

export function formatDate(iso: string, pattern = "dd/MM/yyyy"): string {
  return format(parseISO(iso.slice(0, 10)), pattern, { locale: ptBR });
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function yesterdayIso(): string {
  return format(subDays(new Date(), 1), "yyyy-MM-dd");
}

export function monthRange(date = new Date()): { start: string; end: string } {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function previousMonthRange(date = new Date()): {
  start: string;
  end: string;
} {
  const prev = subMonths(date, 1);
  return monthRange(prev);
}

export function resolveReportRange(
  period: ReportPeriod,
  custom?: { start: string; end: string },
  _weekStartsOn: 0 | 1 = 1,
): { start: string; end: string; label: string } {
  const now = new Date();
  switch (period) {
    case "THIS_MONTH":
      return { ...monthRange(now), label: "Este mês" };
    case "LAST_MONTH":
      return { ...previousMonthRange(now), label: "Mês anterior" };
    case "LAST_3M":
      return {
        start: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: "Últimos 3 meses",
      };
    case "LAST_6M":
      return {
        start: format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: "Últimos 6 meses",
      };
    case "LAST_12M":
      return {
        start: format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: "Últimos 12 meses",
      };
    case "THIS_YEAR":
      return {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(endOfYear(now), "yyyy-MM-dd"),
        label: "Este ano",
      };
    case "CUSTOM":
      return {
        start: custom?.start ?? format(startOfMonth(now), "yyyy-MM-dd"),
        end: custom?.end ?? format(endOfMonth(now), "yyyy-MM-dd"),
        label: "Personalizado",
      };
    default:
      return { ...monthRange(now), label: "Este mês" };
  }
}

export function advanceDate(
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number,
): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addWeeks(date, interval);
    case "MONTHLY":
      return addMonths(date, interval);
    case "YEARLY":
      return addYears(date, interval);
  }
}

export function weekStart(date = new Date(), weekStartsOn: 0 | 1 = 1): Date {
  return startOfWeek(date, { weekStartsOn });
}
