import type { AccountType, BudgetPeriod, CategoryType, RecurrenceFrequency } from "./types";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH: "Dinheiro",
  BANK: "Conta bancária",
  CREDIT_CARD: "Cartão de crédito",
  INVESTMENT: "Investimento",
  OTHER: "Outro",
};

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

export const TRANSACTION_TYPE_LABELS = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
} as const;

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const REPORT_PERIOD_LABELS = {
  THIS_MONTH: "Este mês",
  LAST_MONTH: "Mês anterior",
  LAST_3M: "Últimos 3 meses",
  LAST_6M: "Últimos 6 meses",
  LAST_12M: "Últimos 12 meses",
  THIS_YEAR: "Este ano",
  CUSTOM: "Personalizado",
} as const;

export const NAV_LABELS = {
  app: "BysMoney",
  tagline: "Finanças premium",
  dashboard: "Dashboard",
  finances: "Finanças",
  transactions: "Lançamentos",
  futures: "Futuros",
  accounts: "Contas",
  categories: "Categorias",
  planning: "Planejamento",
  budgets: "Orçamentos",
  goals: "Metas",
  recurring: "Recorrentes",
  reports: "Relatórios",
  overview: "Visão geral",
  trends: "Tendências",
  settings: "Configurações",
  login: "Entrar",
  signup: "Criar conta",
  demo: "Modo demonstração",
  palette: "Busca rápida",
  projected: "Previsto",
} as const;

export const EMPTY_STATES = {
  accounts: "Nenhuma conta ainda. Crie sua primeira conta para começar.",
  categories: "Nenhuma categoria encontrada.",
  transactions: "Nenhum lançamento neste período.",
  futures: "Nenhum lançamento futuro ou previsto.",
  budgets: "Nenhum orçamento definido.",
  goals: "Nenhuma meta em andamento.",
  recurring: "Nenhuma recorrência ativa.",
  reports: "Sem dados para o período selecionado.",
  notifications: "Nenhuma notificação.",
  noAccountBlock: "Crie uma conta antes de registrar lançamentos.",
} as const;

export const DEFAULT_CATEGORY_SEED = [
  { name: "Salário", type: "INCOME" as const, color: "#10B981", icon: "wallet" },
  { name: "Freelance", type: "INCOME" as const, color: "#14B8A6", icon: "briefcase" },
  { name: "Investimentos", type: "INCOME" as const, color: "#22C55E", icon: "trending-up" },
  { name: "Moradia", type: "EXPENSE" as const, color: "#EF4444", icon: "home" },
  { name: "Alimentação", type: "EXPENSE" as const, color: "#F97316", icon: "utensils" },
  { name: "Transporte", type: "EXPENSE" as const, color: "#EAB308", icon: "car" },
  { name: "Saúde", type: "EXPENSE" as const, color: "#EC4899", icon: "heart" },
  { name: "Lazer", type: "EXPENSE" as const, color: "#8B5CF6", icon: "smile" },
  { name: "Educação", type: "EXPENSE" as const, color: "#3B82F6", icon: "book" },
  { name: "Assinaturas", type: "EXPENSE" as const, color: "#6366F1", icon: "repeat" },
];

export const BRAND = {
  primary: "#6366F1",
  accountDefaultColor: "#6366F1",
  accountDefaultIcon: "wallet",
  categoryDefaultColor: "#8B5CF6",
  categoryDefaultIcon: "tag",
  goalDefaultColor: "#10B981",
  goalDefaultIcon: "target",
} as const;
