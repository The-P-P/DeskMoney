import type { DeviceSettings, ThemeMode } from "@/domain/types";
import { hashPassword, verifyPassword, randomSalt } from "@/lib/crypto";
import { nowIso } from "@/lib/utils";
import { getDb, type DeviceSettingsRow } from "../client";
import { mapDeviceSettings } from "../mappers";

const DEVICE_ID = "local";

async function fetchSettings(): Promise<DeviceSettings | null> {
  const db = await getDb();
  const rows = await db.select<DeviceSettingsRow[]>(
    "SELECT * FROM device_settings WHERE id = $1",
    [DEVICE_ID],
  );
  return rows[0] ? mapDeviceSettings(rows[0]) : null;
}

export async function getSettings(): Promise<DeviceSettings> {
  const existing = await fetchSettings();
  if (existing) return existing;

  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO device_settings (id, theme, updated_at)
     VALUES ($1, $2, $3)`,
    [DEVICE_ID, "system", nowIso()],
  );
  const created = await fetchSettings();
  if (!created) {
    throw new Error("Configurações do dispositivo não encontradas.");
  }
  return created;
}

export async function setTheme(theme: ThemeMode): Promise<DeviceSettings> {
  const db = await getDb();
  await db.execute(
    "UPDATE device_settings SET theme = $1, updated_at = $2 WHERE id = $3",
    [theme, nowIso(), DEVICE_ID],
  );
  return getSettings();
}

export async function setSession(userId: string | null): Promise<DeviceSettings> {
  const db = await getDb();
  await db.execute(
    "UPDATE device_settings SET session_user_id = $1, updated_at = $2 WHERE id = $3",
    [userId, nowIso(), DEVICE_ID],
  );
  return getSettings();
}

export async function clearSession(): Promise<DeviceSettings> {
  return setSession(null);
}

export async function setPin(pin: string): Promise<DeviceSettings> {
  const db = await getDb();
  const salt = randomSalt();
  const pinHash = await hashPassword(pin, salt);

  await db.execute(
    "UPDATE device_settings SET pin_hash = $1, pin_salt = $2, updated_at = $3 WHERE id = $4",
    [pinHash, salt, nowIso(), DEVICE_ID],
  );
  return getSettings();
}

export async function clearPin(): Promise<DeviceSettings> {
  const db = await getDb();
  await db.execute(
    "UPDATE device_settings SET pin_hash = NULL, pin_salt = NULL, updated_at = $1 WHERE id = $2",
    [nowIso(), DEVICE_ID],
  );
  return getSettings();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.pinHash || !settings.pinSalt) {
    return false;
  }
  return verifyPassword(pin, settings.pinSalt, settings.pinHash);
}

export async function unlockArchived(minutes: number): Promise<DeviceSettings> {
  const db = await getDb();
  const until = new Date(Date.now() + minutes * 60_000).toISOString();

  await db.execute(
    "UPDATE device_settings SET archived_unlocked_until = $1, updated_at = $2 WHERE id = $3",
    [until, nowIso(), DEVICE_ID],
  );
  return getSettings();
}

export async function isArchivedUnlocked(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.archivedUnlockedUntil) {
    return false;
  }
  return new Date(settings.archivedUnlockedUntil) > new Date();
}
