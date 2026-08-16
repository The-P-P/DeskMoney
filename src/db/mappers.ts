import {
  DEFAULT_PREFERENCES,
  type Account,
  type AccountType,
  type Budget,
  type BudgetPeriod,
  type Category,
  type CategoryType,
  type DeviceSettings,
  type Goal,
  type Notification,
  type Profile,
  type RecurrenceFrequency,
  type RecurringTransaction,
  type ThemeMode,
  type Transaction,
  type TransactionType,
  type UserPreferences,
} from "@/domain/types";
import type {
  AccountRow,
  BudgetRow,
  CategoryRow,
  DeviceSettingsRow,
  GoalRow,
  NotificationRow,
  ProfileRow,
  RecurringRow,
  TransactionRow,
} from "./client";

function intToBool(value: number | boolean | null | undefined): boolean {
  return value === 1 || value === true;
}

function parsePreferences(raw: string): UserPreferences {
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      notifications: {
        ...DEFAULT_PREFERENCES.notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    defaultCurrency: row.default_currency,
    locale: row.locale,
    preferences: parsePreferences(row.preferences),
    isDemo: intToBool(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    name: row.name,
    type: row.type as AccountType,
    initialBalance: row.initial_balance,
    color: row.color,
    icon: row.icon,
    isArchived: intToBool(row.is_archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    name: row.name,
    type: row.type as CategoryType,
    parentId: row.parent_id,
    icon: row.icon,
    color: row.color,
    isSystem: intToBool(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    type: row.type as TransactionType,
    amount: row.amount,
    description: row.description,
    notes: row.notes,
    date: row.date,
    accountId: row.account_id,
    categoryId: row.category_id,
    transferAccountId: row.transfer_account_id,
    attachmentUrl: row.attachment_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    period: row.period as BudgetPeriod,
    amount: row.amount,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    color: row.color,
    icon: row.icon,
    isCompleted: intToBool(row.is_completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecurring(row: RecurringRow): RecurringTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type as "INCOME" | "EXPENSE",
    amount: row.amount,
    description: row.description,
    frequency: row.frequency as RecurrenceFrequency,
    interval: row.interval_n,
    startDate: row.start_date,
    endDate: row.end_date,
    nextRunAt: row.next_run_at,
    isActive: intToBool(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    type: row.type,
    isRead: intToBool(row.is_read),
    href: row.href,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDeviceSettings(row: DeviceSettingsRow): DeviceSettings {
  return {
    id: row.id,
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    theme: row.theme as ThemeMode,
    sessionUserId: row.session_user_id,
    archivedUnlockedUntil: row.archived_unlocked_until,
    updatedAt: row.updated_at,
  };
}

export function serializePreferences(preferences: UserPreferences): string {
  return JSON.stringify(preferences);
}
