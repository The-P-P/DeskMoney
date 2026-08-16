import type { Budget, BudgetPeriod } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type BudgetRow, type SumRow } from "../client";
import { mapBudget } from "../mappers";

export interface CreateBudgetInput {
  categoryId: string;
  period: BudgetPeriod;
  amount: number;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateBudgetInput {
  categoryId?: string;
  period?: BudgetPeriod;
  amount?: number;
  startDate?: string;
  endDate?: string | null;
}

export async function list(userId: string): Promise<Budget[]> {
  const db = await getDb();
  const rows = await db.select<BudgetRow[]>(
    "SELECT * FROM budgets WHERE user_id = $1 ORDER BY start_date DESC",
    [userId],
  );
  return rows.map(mapBudget);
}

export async function getById(id: string): Promise<Budget | null> {
  const db = await getDb();
  const rows = await db.select<BudgetRow[]>(
    "SELECT * FROM budgets WHERE id = $1",
    [id],
  );
  return rows[0] ? mapBudget(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateBudgetInput,
): Promise<Budget> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO budgets (
      id, user_id, category_id, period, amount, start_date, end_date,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      userId,
      input.categoryId,
      input.period,
      input.amount,
      input.startDate,
      input.endDate ?? null,
      now,
      now,
    ],
  );

  const budget = await getById(id);
  if (!budget) {
    throw new Error("Falha ao criar orçamento.");
  }
  return budget;
}

export async function update(
  id: string,
  input: UpdateBudgetInput,
): Promise<Budget> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Orçamento não encontrado.");
  }

  await db.execute(
    `UPDATE budgets SET
      category_id = $1,
      period = $2,
      amount = $3,
      start_date = $4,
      end_date = $5,
      updated_at = $6
    WHERE id = $7`,
    [
      input.categoryId ?? existing.categoryId,
      input.period ?? existing.period,
      input.amount ?? existing.amount,
      input.startDate ?? existing.startDate,
      input.endDate !== undefined ? input.endDate : existing.endDate,
      nowIso(),
      id,
    ],
  );

  const budget = await getById(id);
  if (!budget) {
    throw new Error("Orçamento não encontrado.");
  }
  return budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Orçamento não encontrado.");
  }
  await db.execute("DELETE FROM budgets WHERE id = $1", [id]);
}

export async function spentInPeriod(
  categoryId: string,
  start: string,
  end: string,
): Promise<number> {
  const db = await getDb();
  const rows = await db.select<SumRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE category_id = $1 AND type = 'EXPENSE' AND date >= $2 AND date <= $3`,
    [categoryId, start, end],
  );
  return rows[0]?.total ?? 0;
}

export { deleteBudget as delete };
