import { BRAND } from "@/domain/labels";
import type { Profile } from "@/domain/types";
import { monthRange, previousMonthRange, todayIso } from "@/lib/dates";
import { toCents } from "@/lib/money";
import * as accountsRepo from "./repos/accounts";
import * as budgetsRepo from "./repos/budgets";
import * as categoriesRepo from "./repos/categories";
import * as goalsRepo from "./repos/goals";
import * as notificationsRepo from "./repos/notifications";
import * as profilesRepo from "./repos/profiles";
import * as recurringRepo from "./repos/recurring";
import * as transactionsRepo from "./repos/transactions";

const DEMO_EMAIL = "demo@bysmoney.app";

export async function seedDemoUser(): Promise<Profile> {
  const existing = await profilesRepo.getByEmail(DEMO_EMAIL);
  if (existing) {
    return existing;
  }

  const profile = await profilesRepo.create({
    email: DEMO_EMAIL,
    fullName: "Usuário Demo",
    isDemo: true,
  });

  await categoriesRepo.ensureDefaultCategories(profile.id);

  const checking = await accountsRepo.create(profile.id, {
    name: "Conta Corrente",
    type: "BANK",
    initialBalance: 500_000,
    color: BRAND.primary,
    icon: "landmark",
  });

  const wallet = await accountsRepo.create(profile.id, {
    name: "Carteira",
    type: "CASH",
    initialBalance: 35_000,
    color: "#10B981",
    icon: "wallet",
  });

  const nubank = await accountsRepo.create(profile.id, {
    name: "Nubank",
    type: "CREDIT_CARD",
    initialBalance: 0,
    color: "#8B5CF6",
    icon: "credit-card",
  });

  const salary = await categoriesRepo.findByName(profile.id, "Salário", "INCOME");
  const food = await categoriesRepo.findByName(profile.id, "Alimentação", "EXPENSE");
  const rent = await categoriesRepo.findByName(profile.id, "Moradia", "EXPENSE");
  const transport = await categoriesRepo.findByName(
    profile.id,
    "Transporte",
    "EXPENSE",
  );
  const leisure = await categoriesRepo.findByName(profile.id, "Lazer", "EXPENSE");
  const health = await categoriesRepo.findByName(profile.id, "Saúde", "EXPENSE");
  const subscriptions = await categoriesRepo.findByName(
    profile.id,
    "Assinaturas",
    "EXPENSE",
  );

  const current = monthRange();
  const previous = previousMonthRange();

  const txDefs: Array<{
    type: "INCOME" | "EXPENSE";
    amount: number;
    description: string;
    date: string;
    accountId: string;
    categoryId: string | null;
  }> = [
    {
      type: "INCOME",
      amount: toCents(8500),
      description: "Salário mensal",
      date: `${current.start.slice(0, 8)}05`,
      accountId: checking.id,
      categoryId: salary?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(2200),
      description: "Aluguel",
      date: `${current.start.slice(0, 8)}08`,
      accountId: checking.id,
      categoryId: rent?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(450),
      description: "Supermercado",
      date: `${current.start.slice(0, 8)}10`,
      accountId: nubank.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(89.9),
      description: "Uber",
      date: `${current.start.slice(0, 8)}12`,
      accountId: nubank.id,
      categoryId: transport?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(120),
      description: "Restaurante",
      date: `${current.start.slice(0, 8)}14`,
      accountId: wallet.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(55.9),
      description: "Netflix",
      date: `${current.start.slice(0, 8)}15`,
      accountId: nubank.id,
      categoryId: subscriptions?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(34.9),
      description: "Spotify",
      date: `${current.start.slice(0, 8)}15`,
      accountId: nubank.id,
      categoryId: subscriptions?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(180),
      description: "Farmácia",
      date: `${current.start.slice(0, 8)}18`,
      accountId: wallet.id,
      categoryId: health?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(250),
      description: "Cinema e jantar",
      date: `${current.start.slice(0, 8)}20`,
      accountId: nubank.id,
      categoryId: leisure?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(320),
      description: "Combustível",
      date: `${current.start.slice(0, 8)}22`,
      accountId: checking.id,
      categoryId: transport?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(280),
      description: "Feira e mercearia",
      date: todayIso(),
      accountId: wallet.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "INCOME",
      amount: toCents(8500),
      description: "Salário mensal",
      date: `${previous.start.slice(0, 8)}05`,
      accountId: checking.id,
      categoryId: salary?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(2200),
      description: "Aluguel",
      date: `${previous.start.slice(0, 8)}08`,
      accountId: checking.id,
      categoryId: rent?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(520),
      description: "Supermercado",
      date: `${previous.start.slice(0, 8)}11`,
      accountId: nubank.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(150),
      description: "Transporte público",
      date: `${previous.start.slice(0, 8)}13`,
      accountId: wallet.id,
      categoryId: transport?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(55.9),
      description: "Netflix",
      date: `${previous.start.slice(0, 8)}15`,
      accountId: nubank.id,
      categoryId: subscriptions?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(34.9),
      description: "Spotify",
      date: `${previous.start.slice(0, 8)}15`,
      accountId: nubank.id,
      categoryId: subscriptions?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(380),
      description: "Conta de luz",
      date: `${previous.start.slice(0, 8)}17`,
      accountId: checking.id,
      categoryId: rent?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(95),
      description: "Academia",
      date: `${previous.start.slice(0, 8)}19`,
      accountId: checking.id,
      categoryId: health?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(420),
      description: "Jantar com amigos",
      date: `${previous.start.slice(0, 8)}24`,
      accountId: nubank.id,
      categoryId: leisure?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(210),
      description: "Padaria e café",
      date: `${previous.start.slice(0, 8)}26`,
      accountId: wallet.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(175),
      description: "Manutenção do carro",
      date: `${previous.start.slice(0, 8)}28`,
      accountId: checking.id,
      categoryId: transport?.id ?? null,
    },
    {
      type: "INCOME",
      amount: toCents(1200),
      description: "Freelance design",
      date: `${previous.start.slice(0, 8)}21`,
      accountId: checking.id,
      categoryId: salary?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(65),
      description: "Almoço",
      date: `${current.start.slice(0, 8)}07`,
      accountId: wallet.id,
      categoryId: food?.id ?? null,
    },
    {
      type: "EXPENSE",
      amount: toCents(42),
      description: "Lanche",
      date: `${current.start.slice(0, 8)}09`,
      accountId: wallet.id,
      categoryId: food?.id ?? null,
    },
  ];

  for (const tx of txDefs) {
    await transactionsRepo.create(profile.id, tx);
  }

  if (food) {
    await budgetsRepo.create(profile.id, {
      categoryId: food.id,
      period: "MONTHLY",
      amount: toCents(800),
      startDate: current.start,
      endDate: current.end,
    });
  }

  if (transport) {
    await budgetsRepo.create(profile.id, {
      categoryId: transport.id,
      period: "MONTHLY",
      amount: toCents(400),
      startDate: current.start,
      endDate: current.end,
    });
  }

  if (leisure) {
    await budgetsRepo.create(profile.id, {
      categoryId: leisure.id,
      period: "MONTHLY",
      amount: toCents(300),
      startDate: current.start,
      endDate: current.end,
    });
  }

  await goalsRepo.create(profile.id, {
    name: "Reserva de emergência",
    targetAmount: toCents(15000),
    currentAmount: toCents(8500),
    deadline: `${current.start.slice(0, 4)}-12-31`,
    color: "#10B981",
    icon: "shield",
  });

  await goalsRepo.create(profile.id, {
    name: "Viagem de férias",
    targetAmount: toCents(5000),
    currentAmount: toCents(1200),
    deadline: `${Number(current.start.slice(0, 4)) + 1}-06-30`,
    color: "#3B82F6",
    icon: "plane",
  });

  if (rent) {
    await recurringRepo.create(profile.id, {
      accountId: checking.id,
      categoryId: rent.id,
      type: "EXPENSE",
      amount: toCents(2200),
      description: "Aluguel",
      frequency: "MONTHLY",
      interval: 1,
      startDate: `${current.start.slice(0, 8)}08`,
    });
  }

  if (subscriptions) {
    await recurringRepo.create(profile.id, {
      accountId: nubank.id,
      categoryId: subscriptions.id,
      type: "EXPENSE",
      amount: toCents(55.9),
      description: "Netflix",
      frequency: "MONTHLY",
      interval: 1,
      startDate: `${current.start.slice(0, 8)}15`,
    });

    await recurringRepo.create(profile.id, {
      accountId: nubank.id,
      categoryId: subscriptions.id,
      type: "EXPENSE",
      amount: toCents(34.9),
      description: "Spotify",
      frequency: "MONTHLY",
      interval: 1,
      startDate: `${current.start.slice(0, 8)}15`,
    });
  }

  if (salary) {
    await recurringRepo.create(profile.id, {
      accountId: checking.id,
      categoryId: salary.id,
      type: "INCOME",
      amount: toCents(8500),
      description: "Salário",
      frequency: "MONTHLY",
      interval: 1,
      startDate: `${current.start.slice(0, 8)}05`,
    });
  }

  await notificationsRepo.create(profile.id, {
    title: "Bem-vindo ao BysMoney",
    body: "Explore o modo demonstração com dados de exemplo.",
    type: "info",
  });

  await notificationsRepo.create(profile.id, {
    title: "Orçamento de alimentação",
    body: "Você já utilizou 65% do orçamento de alimentação deste mês.",
    type: "budget_alert",
    href: "/budgets",
  });

  await notificationsRepo.create(profile.id, {
    title: "Meta em progresso",
    body: "Sua reserva de emergência está 57% completa. Continue assim!",
    type: "goal_progress",
    href: "/goals",
  });

  return profile;
}

export { DEMO_EMAIL };
