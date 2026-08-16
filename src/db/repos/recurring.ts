import { addDays, format, parseISO } from "date-fns";
import type {
  ProjectedOccurrence,
  RecurrenceFrequency,
  RecurringTransaction,
} from "@/domain/types";
import { advanceDate, todayIso } from "@/lib/dates";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type RecurringRow } from "../client";
import { mapRecurring } from "../mappers";

export interface CreateRecurringInput {
  accountId: string;
  categoryId?: string | null;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  startDate: string;
  endDate?: string | null;
  isActive?: boolean;
}

export interface UpdateRecurringInput {
  accountId?: string;
  categoryId?: string | null;
  type?: "INCOME" | "EXPENSE";
  amount?: number;
  description?: string;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startDate?: string;
  endDate?: string | null;
  nextRunAt?: string;
  isActive?: boolean;
}

export async function list(userId: string): Promise<RecurringTransaction[]> {
  const db = await getDb();
  const rows = await db.select<RecurringRow[]>(
    "SELECT * FROM recurring_transactions WHERE user_id = $1 ORDER BY next_run_at ASC",
    [userId],
  );
  return rows.map(mapRecurring);
}

export async function getById(id: string): Promise<RecurringTransaction | null> {
  const db = await getDb();
  const rows = await db.select<RecurringRow[]>(
    "SELECT * FROM recurring_transactions WHERE id = $1",
    [id],
  );
  return rows[0] ? mapRecurring(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateRecurringInput,
): Promise<RecurringTransaction> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO recurring_transactions (
      id, user_id, account_id, category_id, type, amount, description,
      frequency, interval_n, start_date, end_date, next_run_at, is_active,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      userId,
      input.accountId,
      input.categoryId ?? null,
      input.type,
      input.amount,
      input.description,
      input.frequency,
      input.interval ?? 1,
      input.startDate,
      input.endDate ?? null,
      input.startDate,
      input.isActive !== false ? 1 : 0,
      now,
      now,
    ],
  );

  const recurring = await getById(id);
  if (!recurring) {
    throw new Error("Falha ao criar recorrência.");
  }
  return recurring;
}

export async function update(
  id: string,
  input: UpdateRecurringInput,
): Promise<RecurringTransaction> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Recorrência não encontrada.");
  }

  await db.execute(
    `UPDATE recurring_transactions SET
      account_id = $1,
      category_id = $2,
      type = $3,
      amount = $4,
      description = $5,
      frequency = $6,
      interval_n = $7,
      start_date = $8,
      end_date = $9,
      next_run_at = $10,
      is_active = $11,
      updated_at = $12
    WHERE id = $13`,
    [
      input.accountId ?? existing.accountId,
      input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      input.type ?? existing.type,
      input.amount ?? existing.amount,
      input.description ?? existing.description,
      input.frequency ?? existing.frequency,
      input.interval ?? existing.interval,
      input.startDate ?? existing.startDate,
      input.endDate !== undefined ? input.endDate : existing.endDate,
      input.nextRunAt ?? existing.nextRunAt,
      input.isActive !== undefined
        ? input.isActive
          ? 1
          : 0
        : existing.isActive
          ? 1
          : 0,
      nowIso(),
      id,
    ],
  );

  const recurring = await getById(id);
  if (!recurring) {
    throw new Error("Recorrência não encontrada.");
  }
  return recurring;
}

export async function deleteRecurring(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Recorrência não encontrada.");
  }
  await db.execute("DELETE FROM recurring_transactions WHERE id = $1", [id]);
}

export async function listActive(
  userId: string,
): Promise<RecurringTransaction[]> {
  const db = await getDb();
  const rows = await db.select<RecurringRow[]>(
    `SELECT * FROM recurring_transactions
     WHERE user_id = $1 AND is_active = 1
     ORDER BY next_run_at ASC`,
    [userId],
  );
  return rows.map(mapRecurring);
}

export async function projectFutures(
  userId: string,
  horizonDays = 90,
): Promise<ProjectedOccurrence[]> {
  const actives = await listActive(userId);
  const today = todayIso();
  const horizonEnd = addDays(parseISO(today), horizonDays);
  const occurrences: ProjectedOccurrence[] = [];

  for (const recurring of actives) {
    let cursor = parseISO(recurring.nextRunAt.slice(0, 10));
    const endLimit = recurring.endDate
      ? parseISO(recurring.endDate.slice(0, 10))
      : null;

    while (cursor <= horizonEnd) {
      if (endLimit && cursor > endLimit) break;

      const dateStr = format(cursor, "yyyy-MM-dd");
      if (dateStr >= today) {
        occurrences.push({
          id: `${recurring.id}-${dateStr}`,
          kind: "projected",
          recurringId: recurring.id,
          type: recurring.type,
          amount: recurring.amount,
          description: recurring.description,
          date: dateStr,
          accountId: recurring.accountId,
          categoryId: recurring.categoryId,
          label: "Previsto",
        });
      }

      cursor = advanceDate(cursor, recurring.frequency, recurring.interval);
    }
  }

  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

export { deleteRecurring as delete };
