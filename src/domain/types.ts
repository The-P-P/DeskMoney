export type AccountType =
  | "CASH"
  | "BANK"
  | "CREDIT_CARD"
  | "INVESTMENT"
  | "OTHER";

export type CategoryType = "INCOME" | "EXPENSE";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type BudgetPeriod = "WEEKLY" | "MONTHLY" | "YEARLY";
export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type ReportPeriod =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_3M"
  | "LAST_6M"
  | "LAST_12M"
  | "THIS_YEAR"
  | "CUSTOM";
export type ThemeMode = "light" | "dark" | "system";

export interface UserPreferences {
  hideBalances: boolean;
  defaultAccountId: string | null;
  dashboardPeriod: "month" | "week";
  weekStartsOn: 0 | 1;
  reportDefaultPeriod: Exclude<ReportPeriod, "CUSTOM">;
  reportExportFormat: "csv" | "pdf";
  productTourCompleted: boolean;
  notifications: {
    budgetAlerts: boolean;
    recurringReminders: boolean;
    goalProgress: boolean;
    pushEnabled: boolean;
  };
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  hideBalances: false,
  defaultAccountId: null,
  dashboardPeriod: "month",
  weekStartsOn: 1,
  reportDefaultPeriod: "THIS_MONTH",
  reportExportFormat: "csv",
  productTourCompleted: false,
  notifications: {
    budgetAlerts: true,
    recurringReminders: true,
    goalProgress: true,
    pushEnabled: false,
  },
};

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  defaultCurrency: string;
  locale: string;
  preferences: UserPreferences;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  icon: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  type: CategoryType;
  parentId: string | null;
  icon: string;
  color: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  organizationId: string | null;
  type: TransactionType;
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  accountId: string;
  categoryId: string | null;
  transferAccountId: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  period: BudgetPeriod;
  amount: number;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  icon: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  nextRunAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  href: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSettings {
  id: string;
  pinHash: string | null;
  pinSalt: string | null;
  theme: ThemeMode;
  sessionUserId: string | null;
  archivedUnlockedUntil: string | null;
  updatedAt: string;
}

export interface ProjectedOccurrence {
  id: string;
  kind: "projected";
  recurringId: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  date: string;
  accountId: string;
  categoryId: string | null;
  label: "Previsto";
}
