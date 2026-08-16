import { BRAND } from "@/domain/labels";
import type { Goal } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type GoalRow } from "../client";
import { mapGoal } from "../mappers";

export interface CreateGoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string | null;
  color?: string;
  icon?: string;
}

export interface UpdateGoalInput {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string | null;
  color?: string;
  icon?: string;
  isCompleted?: boolean;
}

export async function list(userId: string): Promise<Goal[]> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    "SELECT * FROM goals WHERE user_id = $1 ORDER BY is_completed ASC, created_at DESC",
    [userId],
  );
  return rows.map(mapGoal);
}

export async function getById(id: string): Promise<Goal | null> {
  const db = await getDb();
  const rows = await db.select<GoalRow[]>(
    "SELECT * FROM goals WHERE id = $1",
    [id],
  );
  return rows[0] ? mapGoal(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateGoalInput,
): Promise<Goal> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO goals (
      id, user_id, name, target_amount, current_amount, deadline,
      color, icon, is_completed, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      userId,
      input.name,
      input.targetAmount,
      input.currentAmount ?? 0,
      input.deadline ?? null,
      input.color ?? BRAND.goalDefaultColor,
      input.icon ?? BRAND.goalDefaultIcon,
      0,
      now,
      now,
    ],
  );

  const goal = await getById(id);
  if (!goal) {
    throw new Error("Falha ao criar meta.");
  }
  return goal;
}

export async function update(id: string, input: UpdateGoalInput): Promise<Goal> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Meta não encontrada.");
  }

  await db.execute(
    `UPDATE goals SET
      name = $1,
      target_amount = $2,
      current_amount = $3,
      deadline = $4,
      color = $5,
      icon = $6,
      is_completed = $7,
      updated_at = $8
    WHERE id = $9`,
    [
      input.name ?? existing.name,
      input.targetAmount ?? existing.targetAmount,
      input.currentAmount ?? existing.currentAmount,
      input.deadline !== undefined ? input.deadline : existing.deadline,
      input.color ?? existing.color,
      input.icon ?? existing.icon,
      input.isCompleted !== undefined
        ? input.isCompleted
          ? 1
          : 0
        : existing.isCompleted
          ? 1
          : 0,
      nowIso(),
      id,
    ],
  );

  const goal = await getById(id);
  if (!goal) {
    throw new Error("Meta não encontrada.");
  }
  return goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Meta não encontrada.");
  }
  await db.execute("DELETE FROM goals WHERE id = $1", [id]);
}

export async function markComplete(id: string): Promise<Goal> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Meta não encontrada.");
  }

  await db.execute(
    "UPDATE goals SET is_completed = 1, updated_at = $1 WHERE id = $2",
    [nowIso(), id],
  );

  const goal = await getById(id);
  if (!goal) {
    throw new Error("Meta não encontrada.");
  }
  return goal;
}

export { deleteGoal as delete };
