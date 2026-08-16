export { getDb } from "./client";
export type * from "./client";

export * as profilesRepo from "./repos/profiles";
export * as accountsRepo from "./repos/accounts";
export * as categoriesRepo from "./repos/categories";
export * as transactionsRepo from "./repos/transactions";
export * as budgetsRepo from "./repos/budgets";
export * as goalsRepo from "./repos/goals";
export * as recurringRepo from "./repos/recurring";
export * as notificationsRepo from "./repos/notifications";
export * as deviceRepo from "./repos/device";

export { seedDemoUser, DEMO_EMAIL } from "./seed-demo";
export * from "./auth";

export {
  mapProfile,
  mapAccount,
  mapCategory,
  mapTransaction,
  mapBudget,
  mapGoal,
  mapRecurring,
  mapNotification,
  mapDeviceSettings,
  serializePreferences,
} from "./mappers";
