import { hashPassword, randomSalt, verifyPassword } from "@/lib/crypto";
import { createId, nowIso } from "@/lib/utils";
import { DEFAULT_PREFERENCES, type Profile, type UserPreferences } from "@/domain/types";
import { getDb, type ProfileRow } from "../client";
import { mapProfile, serializePreferences } from "../mappers";

export interface CreateProfileInput {
  email: string;
  fullName: string;
  password?: string;
  isDemo?: boolean;
}

export interface UpdateProfileInput {
  fullName?: string | null;
  avatarUrl?: string | null;
  defaultCurrency?: string;
  locale?: string;
}

export async function getById(id: string): Promise<Profile | null> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    "SELECT * FROM profiles WHERE id = $1",
    [id],
  );
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function getByEmail(email: string): Promise<Profile | null> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    "SELECT * FROM profiles WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function create(input: CreateProfileInput): Promise<Profile> {
  const db = await getDb();
  const id = createId();
  const now = nowIso();
  const email = input.email.toLowerCase().trim();
  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;

  if (input.password) {
    passwordSalt = randomSalt();
    passwordHash = await hashPassword(input.password, passwordSalt);
  }

  await db.execute(
    `INSERT INTO profiles (
      id, email, full_name, avatar_url, password_hash, password_salt,
      default_currency, locale, preferences, is_demo, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      email,
      input.fullName,
      null,
      passwordHash,
      passwordSalt,
      "BRL",
      "pt-BR",
      serializePreferences(DEFAULT_PREFERENCES),
      input.isDemo ? 1 : 0,
      now,
      now,
    ],
  );

  const profile = await getById(id);
  if (!profile) {
    throw new Error("Falha ao criar perfil.");
  }
  return profile;
}

export async function updateProfile(
  id: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Perfil não encontrado.");
  }

  await db.execute(
    `UPDATE profiles SET
      full_name = $1,
      avatar_url = $2,
      default_currency = $3,
      locale = $4,
      updated_at = $5
    WHERE id = $6`,
    [
      input.fullName !== undefined ? input.fullName : existing.fullName,
      input.avatarUrl !== undefined ? input.avatarUrl : existing.avatarUrl,
      input.defaultCurrency ?? existing.defaultCurrency,
      input.locale ?? existing.locale,
      nowIso(),
      id,
    ],
  );

  const profile = await getById(id);
  if (!profile) {
    throw new Error("Perfil não encontrado.");
  }
  return profile;
}

export async function updatePreferences(
  id: string,
  preferences: UserPreferences,
): Promise<Profile> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) {
    throw new Error("Perfil não encontrado.");
  }

  await db.execute(
    "UPDATE profiles SET preferences = $1, updated_at = $2 WHERE id = $3",
    [serializePreferences(preferences), nowIso(), id],
  );

  const profile = await getById(id);
  if (!profile) {
    throw new Error("Perfil não encontrado.");
  }
  return profile;
}

export async function verifyLogin(
  email: string,
  password: string,
): Promise<Profile | null> {
  const db = await getDb();
  const rows = await db.select<ProfileRow[]>(
    "SELECT * FROM profiles WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  const row = rows[0];
  if (!row?.password_hash || !row.password_salt) {
    return null;
  }

  const valid = await verifyPassword(password, row.password_salt, row.password_hash);
  return valid ? mapProfile(row) : null;
}

export async function deleteAllUserData(userId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM profiles WHERE id = $1", [userId]);
}
