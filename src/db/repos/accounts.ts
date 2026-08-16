import { BRAND } from "@/domain/labels";
import type { Account, AccountType } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type AccountRow, type CountRow } from "../client";
import { mapAccount } from "../mappers";

export interface ListAccountsOptions {
  includeArchived?: boolean;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  initialBalance: number;
  color?: string;
  icon?: string;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  initialBalance?: number;
  color?: string;
  icon?: string;
}

export async function list(
  userId: string,
  options: ListAccountsOptions = {},
): Promise<Account[]> {
  const db = await getDb();
  const includeArchived = options.includeArchived ?? false;
  const query = includeArchived
    ? "SELECT * FROM accounts WHERE user_id = $1 ORDER BY name ASC"
    : "SELECT * FROM accounts WHERE user_id = $1 AND is_archived = 0 ORDER BY name ASC";

  const rows = await db.select<AccountRow[]>(query, [userId]);
  return rows.map(mapAccount);
}

export async function getById(id: string): Promise<Account | null> {
  const db = await getDb();
  const rows = await db.select<AccountRow[]>(
    "SELECT * FROM accounts WHERE id = $1",
    [id],
  );
  return rows[0] ? mapAccount(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateAccountInput,
): Promise<Account> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO accounts (
      id, user_id, organization_id, name, type, initial_balance,
      color, icon, is_archived, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      userId,
      null,
      input.name,
      input.type,
      input.initialBalance,
      input.color ?? BRAND.accountDefaultColor,
      input.icon ?? BRAND.accountDefaultIcon,
      0,
      now,
      now,
    ],
  );

  const account = await getById(id);
  if (!account) {
    throw new Error("Falha ao criar conta.");
  }
  return account;
}

export async function update(
  id: string,
  input: UpdateAccountInput,
): Promise<Account> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Conta não encontrada.");
  }

  await db.execute(
    `UPDATE accounts SET
      name = $1,
      type = $2,
      initial_balance = $3,
      color = $4,
      icon = $5,
      updated_at = $6
    WHERE id = $7`,
    [
      input.name ?? existing.name,
      input.type ?? existing.type,
      input.initialBalance ?? existing.initialBalance,
      input.color ?? existing.color,
      input.icon ?? existing.icon,
      nowIso(),
      id,
    ],
  );

  const account = await getById(id);
  if (!account) {
    throw new Error("Conta não encontrada.");
  }
  return account;
}

export async function archive(id: string): Promise<Account> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Conta não encontrada.");
  }

  await db.execute(
    "UPDATE accounts SET is_archived = 1, updated_at = $1 WHERE id = $2",
    [nowIso(), id],
  );

  const account = await getById(id);
  if (!account) {
    throw new Error("Conta não encontrada.");
  }
  return account;
}

export async function restore(id: string): Promise<Account> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Conta não encontrada.");
  }

  await db.execute(
    "UPDATE accounts SET is_archived = 0, updated_at = $1 WHERE id = $2",
    [nowIso(), id],
  );

  const account = await getById(id);
  if (!account) {
    throw new Error("Conta não encontrada.");
  }
  return account;
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Conta não encontrada.");
  }

  const rows = await db.select<CountRow[]>(
    `SELECT COUNT(*) as count FROM transactions
     WHERE account_id = $1 OR transfer_account_id = $1`,
    [id],
  );
  if ((rows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Não é possível excluir uma conta com lançamentos. Remova os lançamentos ou mantenha arquivada.",
    );
  }

  await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
}

export async function count(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<CountRow[]>(
    "SELECT COUNT(*) as count FROM accounts WHERE user_id = $1 AND is_archived = 0",
    [userId],
  );
  return rows[0]?.count ?? 0;
}

export async function balance(accountId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ balance: number | null }[]>(
    `SELECT
      a.initial_balance + COALESCE((
        SELECT SUM(
          CASE
            WHEN t.type = 'INCOME' THEN t.amount
            WHEN t.type = 'EXPENSE' THEN -t.amount
            ELSE 0
          END
        )
        FROM transactions t
        WHERE t.account_id = $1
      ), 0) AS balance
    FROM accounts a
    WHERE a.id = $1`,
    [accountId],
  );
  return rows[0]?.balance ?? 0;
}

export { deleteAccount as delete };
