import { DEFAULT_CATEGORY_SEED, BRAND } from "@/domain/labels";
import type { Category, CategoryType } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type CategoryRow, type CountRow } from "../client";
import { mapCategory } from "../mappers";

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  type?: CategoryType;
  color?: string;
  icon?: string;
  parentId?: string | null;
}

export async function list(userId: string): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT * FROM categories WHERE user_id = $1 ORDER BY type ASC, name ASC",
    [userId],
  );
  return rows.map(mapCategory);
}

export async function getById(id: string): Promise<Category | null> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT * FROM categories WHERE id = $1",
    [id],
  );
  return rows[0] ? mapCategory(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO categories (
      id, user_id, organization_id, name, type, parent_id,
      icon, color, is_system, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      userId,
      null,
      input.name,
      input.type,
      input.parentId ?? null,
      input.icon ?? BRAND.categoryDefaultIcon,
      input.color ?? BRAND.categoryDefaultColor,
      0,
      now,
      now,
    ],
  );

  const category = await getById(id);
  if (!category) {
    throw new Error("Falha ao criar categoria.");
  }
  return category;
}

export async function update(
  id: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Categoria não encontrada.");
  }
  if (existing.isSystem) {
    throw new Error("Não é possível editar categorias do sistema.");
  }

  await db.execute(
    `UPDATE categories SET
      name = $1,
      type = $2,
      parent_id = $3,
      icon = $4,
      color = $5,
      updated_at = $6
    WHERE id = $7`,
    [
      input.name ?? existing.name,
      input.type ?? existing.type,
      input.parentId !== undefined ? input.parentId : existing.parentId,
      input.icon ?? existing.icon,
      input.color ?? existing.color,
      nowIso(),
      id,
    ],
  );

  const category = await getById(id);
  if (!category) {
    throw new Error("Categoria não encontrada.");
  }
  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Categoria não encontrada.");
  }
  if (existing.isSystem) {
    throw new Error("Não é possível excluir categorias do sistema.");
  }

  const budgetRows = await db.select<CountRow[]>(
    "SELECT COUNT(*) as count FROM budgets WHERE category_id = $1",
    [id],
  );
  if ((budgetRows[0]?.count ?? 0) > 0) {
    throw new Error("Não é possível excluir uma categoria com orçamentos.");
  }

  const txRows = await db.select<CountRow[]>(
    "SELECT COUNT(*) as count FROM transactions WHERE category_id = $1",
    [id],
  );
  if ((txRows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Não é possível excluir uma categoria com lançamentos.",
    );
  }

  await db.execute("DELETE FROM categories WHERE id = $1", [id]);
}

export async function ensureDefaultCategories(userId: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();

  for (const seed of DEFAULT_CATEGORY_SEED) {
    const existing = await db.select<CategoryRow[]>(
      `SELECT * FROM categories
       WHERE user_id = $1 AND name = $2 AND type = $3 AND is_system = 1`,
      [userId, seed.name, seed.type],
    );
    if (existing.length > 0) continue;

    await db.execute(
      `INSERT INTO categories (
        id, user_id, organization_id, name, type, parent_id,
        icon, color, is_system, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        createId(),
        userId,
        null,
        seed.name,
        seed.type,
        null,
        seed.icon,
        seed.color,
        1,
        now,
        now,
      ],
    );
  }
}

export async function findByName(
  userId: string,
  name: string,
  type: CategoryType,
): Promise<Category | null> {
  const db = await getDb();
  const rows = await db.select<CategoryRow[]>(
    "SELECT * FROM categories WHERE user_id = $1 AND name = $2 AND type = $3 LIMIT 1",
    [userId, name, type],
  );
  return rows[0] ? mapCategory(rows[0]) : null;
}

export { deleteCategory as delete };
