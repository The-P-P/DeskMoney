import Database from "@tauri-apps/plugin-sql";

export type { QueryResult } from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:bysmoney.db";

let dbPromise: Promise<Database> | null = null;

/** Lazy singleton database connection (migrations run on first load). */
export async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_PATH);
  }
  return dbPromise;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  password_hash: string | null;
  password_salt: string | null;
  default_currency: string;
  locale: string;
  preferences: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  type: string;
  initial_balance: number;
  color: string;
  icon: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  type: string;
  parent_id: string | null;
  icon: string;
  color: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: string;
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  category_id: string;
  period: string;
  amount: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string;
  icon: string;
  is_completed: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringRow {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: string;
  amount: number;
  description: string;
  frequency: string;
  interval_n: number;
  start_date: string;
  end_date: string | null;
  next_run_at: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  is_read: number;
  href: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceSettingsRow {
  id: string;
  pin_hash: string | null;
  pin_salt: string | null;
  theme: string;
  session_user_id: string | null;
  archived_unlocked_until: string | null;
  updated_at: string;
}

export interface CountRow {
  count: number;
}

export interface SumRow {
  total: number | null;
}

export interface BalanceRow {
  balance: number;
}
