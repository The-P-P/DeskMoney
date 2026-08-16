import type { Notification } from "@/domain/types";
import { createId, nowIso } from "@/lib/utils";
import { getDb, type CountRow, type NotificationRow } from "../client";
import { mapNotification } from "../mappers";

export interface CreateNotificationInput {
  title: string;
  body: string;
  type: string;
  href?: string | null;
}

export async function list(userId: string): Promise<Notification[]> {
  const db = await getDb();
  const rows = await db.select<NotificationRow[]>(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows.map(mapNotification);
}

export async function getById(id: string): Promise<Notification | null> {
  const db = await getDb();
  const rows = await db.select<NotificationRow[]>(
    "SELECT * FROM notifications WHERE id = $1",
    [id],
  );
  return rows[0] ? mapNotification(rows[0]) : null;
}

export async function create(
  userId: string,
  input: CreateNotificationInput,
): Promise<Notification> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();

  await db.execute(
    `INSERT INTO notifications (
      id, user_id, title, body, type, is_read, href, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      userId,
      input.title,
      input.body,
      input.type,
      0,
      input.href ?? null,
      now,
      now,
    ],
  );

  const notification = await getById(id);
  if (!notification) {
    throw new Error("Falha ao criar notificação.");
  }
  return notification;
}

export async function markRead(id: string): Promise<Notification> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Notificação não encontrada.");
  }

  await db.execute(
    "UPDATE notifications SET is_read = 1, updated_at = $1 WHERE id = $2",
    [nowIso(), id],
  );

  const notification = await getById(id);
  if (!notification) {
    throw new Error("Notificação não encontrada.");
  }
  return notification;
}

export async function markAllRead(userId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE notifications SET is_read = 1, updated_at = $1 WHERE user_id = $2 AND is_read = 0",
    [nowIso(), userId],
  );
}

export async function unreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<CountRow[]>(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0",
    [userId],
  );
  return rows[0]?.count ?? 0;
}
