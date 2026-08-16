import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  eachDayOfInterval,
  format,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  EMPTY_STATES,
  NAV_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/domain/labels";
import type { Transaction } from "@/domain/types";
import {
  accountsRepo,
  budgetsRepo,
  categoriesRepo,
  goalsRepo,
  recurringRepo,
  transactionsRepo,
} from "@/db";
import { formatDate, monthRange, previousMonthRange, todayIso } from "@/lib/dates";
import { ComparisonBadge } from "@/features/shared/comparison-badge";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F97316",
  "#EF4444",
  "#8B5CF6",
  "#EAB308",
];

type UpcomingItem = {
  id: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  kind: "scheduled" | "projected";
};

type DailyFlowPoint = {
  date: string;
  label: string;
  net: number;
};

function StatPill({
  label,
  cents,
  tone,
  hideBalances,
  comparison,
}: {
  label: string;
  cents: number;
  tone?: "success" | "destructive" | "default";
  hideBalances: boolean;
  comparison?: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "truncate text-lg font-semibold tracking-tight",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        <MoneyText cents={cents} hideBalances={hideBalances} />
      </p>
      {comparison}
    </div>
  );
}

function buildDailyFlow(
  monthTx: Transaction[],
  start: string,
  endCap: string,
): DailyFlowPoint[] {
  const byDay = new Map<string, number>();
  for (const tx of monthTx) {
    if (tx.type === "TRANSFER") continue;
    const day = tx.date.slice(0, 10);
    if (day < start || day > endCap) continue;
    const signed = tx.type === "INCOME" ? tx.amount : -tx.amount;
    byDay.set(day, (byDay.get(day) ?? 0) + signed);
  }

  return eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(endCap),
  }).map((d) => {
    const date = format(d, "yyyy-MM-dd");
    return {
      date,
      label: format(d, "dd MMM", { locale: ptBR }),
      net: byDay.get(date) ?? 0,
    };
  });
}

function buildSpendingBars(
  monthTx: Transaction[],
  categoryMap: Map<string, { name: string; color?: string | null }>,
) {
  const byCategory = new Map<string, number>();
  let uncategorized = 0;
  for (const tx of monthTx) {
    if (tx.type !== "EXPENSE") continue;
    if (!tx.categoryId) {
      uncategorized += tx.amount;
      continue;
    }
    byCategory.set(
      tx.categoryId,
      (byCategory.get(tx.categoryId) ?? 0) + tx.amount,
    );
  }

  const ranked = [...byCategory.entries()]
    .map(([id, value]) => ({
      name: categoryMap.get(id)?.name ?? "Outros",
      value,
      color: categoryMap.get(id)?.color ?? CHART_COLORS[0],
    }))
    .sort((a, b) => b.value - a.value);

  const top = ranked.slice(0, 5);
  const rest = ranked.slice(5);
  const othersValue =
    rest.reduce((s, i) => s + i.value, 0) + uncategorized;

  const spendingChart =
    othersValue > 0
      ? [
          ...top,
          {
            name: "Outros",
            value: othersValue,
            color: CHART_COLORS[5],
          },
        ]
      : top;

  const spendingTotal = spendingChart.reduce((s, i) => s + i.value, 0);
  return { spendingChart, spendingTotal };
}

export function DashboardPage() {
  const userId = useUserId();
  const hideBalances = useHideBalances();

  const { start, end } = monthRange();
  const prev = previousMonthRange();
  const today = todayIso();
  const horizon = format(addDays(parseISO(today), 14), "yyyy-MM-dd");
  const monthLabel = format(parseISO(start), "MMMM yyyy", { locale: ptBR });
  const flowEnd = today < end ? today : end;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", userId, start, end],
    enabled: Boolean(userId),
    queryFn: async () => {
      const uid = userId!;
      const [
        accounts,
        categories,
        income,
        expense,
        prevIncome,
        prevExpense,
        recent,
        budgets,
        goals,
        monthTx,
        futureTx,
        projected,
      ] = await Promise.all([
        accountsRepo.list(uid),
        categoriesRepo.list(uid),
        transactionsRepo.sumByType(uid, "INCOME", start, end),
        transactionsRepo.sumByType(uid, "EXPENSE", start, end),
        transactionsRepo.sumByType(uid, "INCOME", prev.start, prev.end),
        transactionsRepo.sumByType(uid, "EXPENSE", prev.start, prev.end),
        transactionsRepo.recent(uid, 5),
        budgetsRepo.list(uid),
        goalsRepo.list(uid),
        transactionsRepo.list(uid, { start, end }),
        transactionsRepo.list(uid, { start: today, end: horizon }),
        recurringRepo.projectFutures(uid),
      ]);

      const balances = await Promise.all(
        accounts.map(async (a) => ({
          id: a.id,
          name: a.name,
          color: a.color,
          balance: await accountsRepo.balance(a.id),
        })),
      );
      const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const { spendingChart, spendingTotal } = buildSpendingBars(
        monthTx,
        categoryMap,
      );
      const dailyFlow = buildDailyFlow(monthTx, start, flowEnd);

      const budgetProgress = await Promise.all(
        budgets.slice(0, 6).map(async (b) => {
          const spent = await budgetsRepo.spentInPeriod(
            b.categoryId,
            b.startDate.slice(0, 10),
            (b.endDate ?? end).slice(0, 10),
          );
          const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
          return {
            ...b,
            spent,
            pct,
            categoryName: categoryMap.get(b.categoryId)?.name ?? "—",
          };
        }),
      );

      const scheduledUpcoming: UpcomingItem[] = futureTx
        .filter((t) => t.date.slice(0, 10) > today)
        .map((t) => ({
          id: t.id,
          description: t.description,
          amount: t.amount,
          type: t.type,
          date: t.date.slice(0, 10),
          kind: "scheduled" as const,
        }));

      const projectedUpcoming: UpcomingItem[] = projected
        .filter(
          (p) =>
            p.date.slice(0, 10) > today && p.date.slice(0, 10) <= horizon,
        )
        .map((p) => ({
          id: `proj-${p.recurringId}-${p.date}`,
          description: p.description,
          amount: p.amount,
          type: p.type,
          date: p.date.slice(0, 10),
          kind: "projected" as const,
        }));

      const upcoming = [...scheduledUpcoming, ...projectedUpcoming]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

      const activeGoals = goals.filter((g) => !g.isCompleted).slice(0, 4);
      const net = income - expense;

      return {
        totalBalance,
        income,
        expense,
        net,
        prevIncome,
        prevExpense,
        prevNet: prevIncome - prevExpense,
        recent,
        spendingChart,
        spendingTotal,
        dailyFlow,
        budgetProgress: budgetProgress.slice(0, 5),
        upcoming,
        activeGoals,
        accounts: balances,
        categoryMap,
        hasAccounts: accounts.length > 0,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Carregando dashboard…
      </div>
    );
  }

  const money = (cents: number) => (
    <MoneyText cents={cents} hideBalances={hideBalances} />
  );

  const sparkPositive = data.net >= 0;
  const sparkStroke = sparkPositive ? "hsl(160 84% 39%)" : "hsl(0 84% 60%)";
  const sparkFillId = sparkPositive ? "flowFillPos" : "flowFillNeg";
  const hasFlowActivity = data.dailyFlow.some((d) => d.net !== 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" />
              Saldo total
            </div>
            <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {money(data.totalBalance)}
            </p>
            <p className="text-sm capitalize text-muted-foreground">
              {monthLabel}
              <span className="normal-case">
                {" "}
                · {data.accounts.length} conta
                {data.accounts.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Fluxo do mês
              </p>
              <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                <Link to="/reports?tab=trends" viewTransition>
                  Tendências
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            </div>
            {hasFlowActivity ? (
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyFlow}>
                    <defs>
                      <linearGradient
                        id={sparkFillId}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={sparkStroke}
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor={sparkStroke}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const point = payload[0].payload as DailyFlowPoint;
                        return (
                          <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
                            <p className="text-muted-foreground">
                              {point.label}
                            </p>
                            <p
                              className={cn(
                                "font-medium tabular-nums",
                                point.net >= 0
                                  ? "text-success"
                                  : "text-destructive",
                              )}
                            >
                              {hideBalances ? (
                                "••••"
                              ) : (
                                <>
                                  {point.net >= 0 ? "+" : "−"}
                                  <MoneyText cents={Math.abs(point.net)} />
                                </>
                              )}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke={sparkStroke}
                      strokeWidth={2}
                      fill={`url(#${sparkFillId})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-24 items-center text-sm text-muted-foreground">
                Sem movimentações neste mês
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 border-t px-5 py-4 sm:gap-8 sm:px-6">
          <StatPill
            label="Receitas"
            cents={data.income}
            tone="success"
            hideBalances={hideBalances}
            comparison={
              <ComparisonBadge
                current={data.income}
                previous={data.prevIncome}
                compact
                className={hideBalances ? "invisible" : undefined}
              />
            }
          />
          <StatPill
            label="Despesas"
            cents={data.expense}
            tone="destructive"
            hideBalances={hideBalances}
            comparison={
              <ComparisonBadge
                current={data.expense}
                previous={data.prevExpense}
                invert
                compact
                className={hideBalances ? "invisible" : undefined}
              />
            }
          />
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <TrendingUp className="size-3" />
              Fluxo
            </p>
            <p
              className={cn(
                "truncate text-lg font-semibold tracking-tight",
                data.net >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {hideBalances ? (
                <MoneyText cents={data.net} hideBalances />
              ) : (
                <>
                  {data.net >= 0 ? "+" : "−"}
                  <MoneyText cents={Math.abs(data.net)} />
                </>
              )}
            </p>
            <ComparisonBadge
              current={data.net}
              previous={data.prevNet}
              compact
              className={hideBalances ? "invisible" : undefined}
            />
          </div>
        </div>

        {data.accounts.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t bg-muted/20 px-5 py-3 sm:px-6">
            {data.accounts.map((a) => (
              <Link
                key={a.id}
                to={`/finances?tab=accounts&account=${a.id}`}
                viewTransition
                className="flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: a.color || "#6366F1" }}
                />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{money(a.balance)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming — always visible */}
      <section className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-muted-foreground" />
            Próximos 14 dias
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
            <Link to="/finances?tab=futures" viewTransition>
              Ver
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        {data.upcoming.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nada agendado nos próximos 14 dias.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.upcoming.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.date, "dd MMM")}
                    {item.kind === "projected" ? " · previsto" : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    item.type === "INCOME"
                      ? "text-success"
                      : "text-destructive",
                  )}
                >
                  {item.type === "INCOME" ? "+" : "−"}
                  {money(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pie + recent transactions */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Gastos por categoria</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link to="/reports?tab=categories" viewTransition>
                Detalhes
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {data.spendingChart.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.transactions}
              actionLabel="Registrar lançamento"
              actionTo="/finances?create=1"
            />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative mx-auto h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.spendingChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {data.spendingChart.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={
                            entry.color ??
                            CHART_COLORS[i % CHART_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        hideBalances
                          ? "••••"
                          : `R$ ${(Number(value) / 100).toFixed(2)}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <span className="text-sm font-semibold">
                    {money(data.spendingTotal)}
                  </span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {data.spendingChart.map((item, i) => {
                  const pct =
                    data.spendingTotal > 0
                      ? (item.value / data.spendingTotal) * 100
                      : 0;
                  return (
                    <li
                      key={item.name}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            item.color ??
                            CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums">
                        {money(item.value)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lançamentos recentes</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link to="/finances" viewTransition>
                {NAV_LABELS.transactions}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {data.recent.length === 0 ? (
            <EmptyCta
              message={
                data.hasAccounts
                  ? EMPTY_STATES.transactions
                  : EMPTY_STATES.noAccountBlock
              }
              actionLabel={
                data.hasAccounts ? "Novo lançamento" : "Criar conta"
              }
              actionTo={
                data.hasAccounts
                  ? "/finances?create=1"
                  : "/finances?tab=accounts"
              }
            />
          ) : (
            <ul>
              {data.recent.map((tx: Transaction) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        tx.type === "INCOME"
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {tx.type === "INCOME" ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <ArrowDownRight className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.date)} ·{" "}
                        {data.categoryMap.get(tx.categoryId ?? "")?.name ??
                          TRANSACTION_TYPE_LABELS[
                            tx.type === "TRANSFER" ? "EXPENSE" : tx.type
                          ]}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      tx.type === "INCOME"
                        ? "text-success"
                        : "text-destructive",
                    )}
                  >
                    {tx.type === "INCOME" ? "+" : "−"}
                    {money(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Budgets + goals */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Orçamentos</h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link to="/planning" viewTransition>
                {NAV_LABELS.budgets}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {data.budgetProgress.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.budgets}
              actionLabel="Criar orçamento"
              actionTo="/planning"
            />
          ) : (
            <div className="space-y-4">
              {data.budgetProgress.map((b) => {
                const barPct = Math.min(100, b.pct);
                const over = b.pct > 100;
                const warn = b.pct >= 85 && !over;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium">
                        {b.categoryName}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 tabular-nums">
                        <span className="text-muted-foreground">
                          {money(b.spent)}
                          <span className="text-muted-foreground/60"> / </span>
                          {money(b.amount)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            over && "text-destructive",
                            warn && "text-warning",
                            !over && !warn && "text-muted-foreground",
                          )}
                        >
                          {over ? "estourou" : `${b.pct.toFixed(0)}%`}
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={barPct}
                      className={cn(
                        over && "[&>div]:bg-destructive",
                        warn && "[&>div]:bg-warning",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="size-3.5 text-muted-foreground" />
              Metas
            </h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
              <Link to="/planning?tab=goals" viewTransition>
                {NAV_LABELS.goals}
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          {data.activeGoals.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.goals}
              actionLabel="Criar meta"
              actionTo="/planning?tab=goals"
            />
          ) : (
            <div className="space-y-4">
              {data.activeGoals.map((g) => {
                const pct =
                  g.targetAmount > 0
                    ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                    : 0;
                return (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={pct} />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {money(g.currentAmount)} de {money(g.targetAmount)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
