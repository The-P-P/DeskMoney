import type { Transaction, TransactionType } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type SumRow, type TransactionRow } from "../client";
import { mapTransaction } from "../mappers";

export interface ListTransactionsFilters {
  accountId?: string;
  categoryId?: string;
  start?: string;
  end?: string;
  type?: TransactionType;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  description: string;
  notes?: string | null;
  date: string;
  accountId: string;
  categoryId?: string | null;
  transferAccountId?: string | null;
  attachmentUrl?: string | null;
}

export interface UpdateTransactionInput {
  type?: TransactionType;
  amount?: number;
  description?: string;
  notes?: string | null;
  date?: string;
  accountId?: string;
  categoryId?: string | null;
  transferAccountId?: string | null;
  attachmentUrl?: string | null;
}

function buildListQuery(
  userId: string,
  filters: ListTransactionsFilters,
): { sql: string; params: unknown[] } {
  const conditions = ["user_id = $1"];
  const params: unknown[] = [userId];
  let idx = 2;

  if (filters.accountId) {
    conditions.push(`account_id = $${idx}`);
    params.push(filters.accountId);
    idx += 1;
  }
  if (filters.categoryId) {
    conditions.push(`category_id = $${idx}`);
    params.push(filters.categoryId);
    idx += 1;
  }
  if (filters.start) {
    conditions.push(`date >= $${idx}`);
    params.push(filters.start);
    idx += 1;
  }
  if (filters.end) {
    conditions.push(`date <= $${idx}`);
    params.push(filters.end);
    idx += 1;
  }
  if (filters.type) {
    conditions.push(`type = $${idx}`);
    params.push(filters.type);
  }

  return {
    sql: `SELECT * FROM transactions WHERE ${conditions.join(" AND ")} ORDER BY date DESC, created_at DESC`,
    params,
  };
}

export async function list(
  userId: string,
  filters: ListTransactionsFilters = {},
): Promise<Transaction[]> {
  const db = await getDb();
  const { sql, params } = buildListQuery(userId, filters);
  const rows = await db.select<TransactionRow[]>(sql, params);
  return rows.map(mapTransaction);
}

export async function getById(id: string): Promise<Transaction | null> {
  const db = await getDb();
  const rows = await db.select<TransactionRow[]>(
    "SELECT * FROM transactions WHERE id = $1",
    [id],
  );
  return rows[0] ? mapTransaction(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateTransactionInput,
): Promise<Transaction> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO transactions (
      id, user_id, organization_id, type, amount, description, notes, date,
      account_id, category_id, transfer_account_id, attachment_url,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      userId,
      null,
      input.type,
      input.amount,
      input.description,
      input.notes ?? null,
      input.date,
      input.accountId,
      input.categoryId ?? null,
      input.transferAccountId ?? null,
      input.attachmentUrl ?? null,
      now,
      now,
    ],
  );

  const transaction = await getById(id);
  if (!transaction) {
    throw new Error("Falha ao criar lançamento.");
  }
  return transaction;
}

export async function update(
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Lançamento não encontrado.");
  }

  await db.execute(
    `UPDATE transactions SET
      type = $1,
      amount = $2,
      description = $3,
      notes = $4,
      date = $5,
      account_id = $6,
      category_id = $7,
      transfer_account_id = $8,
      attachment_url = $9,
      updated_at = $10
    WHERE id = $11`,
    [
      input.type ?? existing.type,
      input.amount ?? existing.amount,
      input.description ?? existing.description,
      input.notes !== undefined ? input.notes : existing.notes,
      input.date ?? existing.date,
      input.accountId ?? existing.accountId,
      input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      input.transferAccountId !== undefined
        ? input.transferAccountId
        : existing.transferAccountId,
      input.attachmentUrl !== undefined
        ? input.attachmentUrl
        : existing.attachmentUrl,
      nowIso(),
      id,
    ],
  );

  const transaction = await getById(id);
  if (!transaction) {
    throw new Error("Lançamento não encontrado.");
  }
  return transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Lançamento não encontrado.");
  }
  await db.execute("DELETE FROM transactions WHERE id = $1", [id]);
}

export async function recent(
  userId: string,
  limit = 10,
): Promise<Transaction[]> {
  const db = await getDb();
  const rows = await db.select<TransactionRow[]>(
    `SELECT * FROM transactions
     WHERE user_id = $1
     ORDER BY date DESC, created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map(mapTransaction);
}

export async function sumByType(
  userId: string,
  type: TransactionType,
  start: string,
  end: string,
): Promise<number> {
  const db = await getDb();
  const rows = await db.select<SumRow[]>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = $1 AND type = $2 AND date >= $3 AND date <= $4`,
    [userId, type, start, end],
  );
  return rows[0]?.total ?? 0;
}

export { deleteTransaction as delete };
