import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Download,
  FileText,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  PieChart,
  Tags,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPTY_STATES, NAV_LABELS, REPORT_PERIOD_LABELS } from "@/domain/labels";
import type { Category, ReportPeriod, Transaction } from "@/domain/types";
import {
  accountsRepo,
  budgetsRepo,
  categoriesRepo,
  transactionsRepo,
} from "@/db";
import { resolveReportRange } from "@/lib/dates";
import {
  exportCategoriesCsv,
  exportReportPdf,
  exportTransactionsCsv,
} from "@/lib/export";
import { ComparisonBadge } from "@/features/shared/comparison-badge";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores";

type ReportsTab = "overview" | "categories" | "trends" | "accounts" | "budgets";

const CHART_COLORS = ["#6366F1", "#10B981", "#F97316", "#EF4444", "#8B5CF6", "#EAB308"];

function tabFromSearch(tab: string | null): ReportsTab {
  if (
    tab === "categories" ||
    tab === "trends" ||
    tab === "accounts" ||
    tab === "budgets"
  ) {
    return tab;
  }
  return "overview";
}

function prevPeriodRange(start: string, end: string) {
  const days = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  const prevEnd = new Date(parseISO(start));
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

function moneyTooltip(hideBalances: boolean) {
  return (value: unknown) =>
    hideBalances ? "••••" : `R$ ${(Number(value) / 100).toFixed(2)}`;
}

function ChartPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      {title && <h3 className="mb-4 text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

export function ReportsPage() {
  const userId = useUserId();
  const hideBalances = useHideBalances();
  const weekStartsOn = useSessionStore((s) => s.preferences.weekStartsOn);
  const defaultPeriod = useSessionStore((s) => s.preferences.reportDefaultPeriod);
  const profile = useSessionStore((s) => s.profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams.get("tab"));

  const [period, setPeriod] = useState<ReportPeriod>(defaultPeriod);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const range = resolveReportRange(
    period,
    period === "CUSTOM" ? { start: customStart, end: customEnd } : undefined,
    weekStartsOn,
  );
  const prevRange = prevPeriodRange(range.start, range.end);

  const { data, isLoading } = useQuery({
    queryKey: [
      "reports",
      userId,
      range.start,
      range.end,
      accountFilter,
      categoryFilter,
    ],
    enabled: Boolean(userId),
    queryFn: async () => {
      const uid = userId!;
      const filters = {
        start: range.start,
        end: range.end,
        accountId: accountFilter !== "all" ? accountFilter : undefined,
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
      };

      const [transactions, categories, accounts, budgets] = await Promise.all([
        transactionsRepo.list(uid, filters),
        categoriesRepo.list(uid),
        accountsRepo.list(uid),
        budgetsRepo.list(uid),
      ]);

      const prevTransactions = await transactionsRepo.list(uid, {
        ...filters,
        start: prevRange.start,
        end: prevRange.end,
      });

      const income = transactions
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amount, 0);
      const expense = transactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0);
      const prevIncome = prevTransactions
        .filter((t) => t.type === "INCOME")
        .reduce((s, t) => s + t.amount, 0);
      const prevExpense = prevTransactions
        .filter((t) => t.type === "EXPENSE")
        .reduce((s, t) => s + t.amount, 0);

      const net = income - expense;
      const prevNet = prevIncome - prevExpense;
      const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
      const days = Math.max(
        1,
        differenceInCalendarDays(parseISO(range.end), parseISO(range.start)) + 1,
      );
      const avgDailyExpense = expense / days;

      const categoryMap = new Map(categories.map((c) => [c.id, c]));
      const byCategory = aggregateByCategory(transactions, categoryMap);
      const byAccount = aggregateByAccount(transactions, accounts);
      const monthlyTrend = aggregateMonthly(transactions);

      const budgetRows = await Promise.all(
        budgets.map(async (b) => {
          const spent = await budgetsRepo.spentInPeriod(
            b.categoryId,
            range.start,
            range.end,
          );
          const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
          return {
            name: categoryMap.get(b.categoryId)?.name ?? "—",
            budget: b.amount,
            spent,
            pct,
          };
        }),
      );

      const insights = buildInsights({
        transactions,
        byCategory,
        income,
        expense,
        savingsRate,
        budgetRows,
        prevIncome,
        prevExpense,
      });

      return {
        transactions,
        categories,
        accounts,
        income,
        expense,
        net,
        prevIncome,
        prevExpense,
        prevNet,
        savingsRate,
        avgDailyExpense,
        count: transactions.length,
        prevCount: prevTransactions.length,
        byCategory,
        byAccount,
        monthlyTrend,
        budgetRows,
        insights,
        categoryMap,
      };
    },
  });

  const accountNames = useMemo(
    () => new Map(data?.accounts.map((a) => [a.id, a.name]) ?? []),
    [data?.accounts],
  );

  function setTab(next: ReportsTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params);
  }

  async function handleExportCsv() {
    if (!data) return;
    const ok = await exportTransactionsCsv(
      data.transactions,
      data.categoryMap,
      accountNames,
    );
    if (ok) toast.success("CSV exportado com sucesso");
  }

  async function handleExportCategoriesCsv() {
    if (!data) return;
    const ok = await exportCategoriesCsv(data.byCategory);
    if (ok) toast.success("CSV de categorias exportado");
  }

  async function handleExportPdf() {
    if (!data) return;
    const accountFilterLabel =
      accountFilter !== "all"
        ? (data.accounts.find((a) => a.id === accountFilter)?.name ?? null)
        : null;
    const categoryFilterLabel =
      categoryFilter !== "all"
        ? (data.categories.find((c) => c.id === categoryFilter)?.name ?? null)
        : null;

    const ok = await exportReportPdf({
      periodLabel: range.label,
      start: range.start,
      end: range.end,
      profileName: profile?.fullName || profile?.email || null,
      accountFilterLabel,
      categoryFilterLabel,
      income: data.income,
      expense: data.expense,
      net: data.net,
      savingsRate: data.savingsRate,
      avgDailyExpense: data.avgDailyExpense,
      count: data.count,
      prevIncome: data.prevIncome,
      prevExpense: data.prevExpense,
      prevNet: data.prevNet,
      insights: data.insights,
      byCategory: data.byCategory,
      byAccount: data.byAccount,
      monthlyTrend: data.monthlyTrend,
      budgetRows: data.budgetRows,
      transactions: data.transactions,
      categoryMap: data.categoryMap,
      accountNames,
    });
    if (ok) toast.success("PDF exportado com sucesso");
  }

  if (isLoading || !data) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Carregando relatórios…
      </div>
    );
  }

  const noData = data.count === 0;
  const expenseTotal = data.byCategory
    .filter((c) => c.type === "EXPENSE")
    .reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {NAV_LABELS.reports}
          </h2>
          <p className="text-sm text-muted-foreground">{range.label}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCategoriesCsv}>
            <Download className="size-3.5" />
            Categorias
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="size-3.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <section className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(REPORT_PERIOD_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === "CUSTOM" && (
          <>
            <Input
              type="date"
              className="w-40"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <Input
              type="date"
              className="w-40"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {data.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Hero KPIs — one surface */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Receitas</p>
            <p className="text-2xl font-semibold text-success">
              <MoneyText cents={data.income} hideBalances={hideBalances} />
            </p>
            <ComparisonBadge
              current={data.income}
              previous={data.prevIncome}
              className={hideBalances ? "invisible" : undefined}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Despesas</p>
            <p className="text-2xl font-semibold text-destructive">
              <MoneyText cents={data.expense} hideBalances={hideBalances} />
            </p>
            <ComparisonBadge
              current={data.expense}
              previous={data.prevExpense}
              invert
              className={hideBalances ? "invisible" : undefined}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Fluxo</p>
            <p
              className={cn(
                "text-2xl font-semibold",
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
              className={hideBalances ? "invisible" : undefined}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              Taxa de poupança
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {data.savingsRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {data.count} lançamento{data.count === 1 ? "" : "s"} · média{" "}
              <MoneyText
                cents={Math.round(data.avgDailyExpense)}
                hideBalances={hideBalances}
              />
              /dia
            </p>
          </div>
        </div>
      </section>

      {data.insights.length > 0 && (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-primary" />
            Insights
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {data.insights.map((text) => (
              <li key={text} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportsTab)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/50 p-1 sm:w-auto">
          <TabsTrigger
            value="overview"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <LayoutDashboard className="size-3.5" />
            {NAV_LABELS.overview}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Tags className="size-3.5" />
            {NAV_LABELS.categories}
          </TabsTrigger>
          <TabsTrigger
            value="trends"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <TrendingUp className="size-3.5" />
            {NAV_LABELS.trends}
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Landmark className="size-3.5" />
            {NAV_LABELS.accounts}
          </TabsTrigger>
          <TabsTrigger
            value="budgets"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <PieChart className="size-3.5" />
            {NAV_LABELS.budgets}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {noData ? (
            <EmptyCta message={EMPTY_STATES.reports} />
          ) : (
            <ChartPanel title="Receitas vs despesas">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Receitas", value: data.income, fill: "#10B981" },
                      { name: "Despesas", value: data.expense, fill: "#EF4444" },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) =>
                        hideBalances ? "•••" : `${v / 100}`
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={moneyTooltip(hideBalances)} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      <Cell fill="#10B981" />
                      <Cell fill="#EF4444" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          {data.byCategory.length === 0 ? (
            <EmptyCta message={EMPTY_STATES.reports} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartPanel title="Por categoria" className="lg:col-span-3">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byCategory.slice(0, 8)} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) =>
                          hideBalances ? "•••" : `${v / 100}`
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={moneyTooltip(hideBalances)} />
                      <Bar
                        dataKey="total"
                        fill="#6366F1"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>
              <ChartPanel title="Ranking" className="lg:col-span-2">
                <ul className="space-y-3">
                  {data.byCategory.slice(0, 8).map((item, i) => {
                    const pct =
                      expenseTotal > 0 && item.type === "EXPENSE"
                        ? (item.total / expenseTotal) * 100
                        : 0;
                    return (
                      <li key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                              {i + 1}
                            </span>
                            <span className="truncate font-medium">
                              {item.name}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <MoneyText
                              cents={item.total}
                              hideBalances={hideBalances}
                            />
                          </span>
                        </div>
                        {item.type === "EXPENSE" && expenseTotal > 0 && (
                          <Progress value={pct} className="h-1.5" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </ChartPanel>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          {data.monthlyTrend.length === 0 ? (
            <EmptyCta message={EMPTY_STATES.reports} />
          ) : (
            <ChartPanel title="Tendência mensal">
              <div className="mb-3 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-success">
                  <span className="size-2 rounded-full bg-success" />
                  Receitas
                </span>
                <span className="flex items-center gap-1.5 text-destructive">
                  <span className="size-2 rounded-full bg-destructive" />
                  Despesas
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={(v) =>
                        hideBalances ? "•••" : `${v / 100}`
                      }
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={moneyTooltip(hideBalances)} />
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#10B981"
                      name="Receitas"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      stroke="#EF4444"
                      name="Despesas"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          {data.byAccount.length === 0 ? (
            <EmptyCta message={EMPTY_STATES.reports} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <ChartPanel title="Movimentação por conta" className="lg:col-span-3">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byAccount}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v) =>
                          hideBalances ? "•••" : `${v / 100}`
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={moneyTooltip(hideBalances)} />
                      <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                        {data.byAccount.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.color ||
                              CHART_COLORS[i % CHART_COLORS.length]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>
              <ChartPanel title="Contas" className="lg:col-span-2">
                <ul className="space-y-2">
                  {data.byAccount.map((a, i) => (
                    <li
                      key={a.name}
                      className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              a.color || CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                        <span className="truncate font-medium">{a.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <MoneyText
                          cents={a.total}
                          hideBalances={hideBalances}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </ChartPanel>
            </div>
          )}
        </TabsContent>

        <TabsContent value="budgets" className="mt-4">
          {data.budgetRows.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.budgets}
              actionLabel="Criar orçamento"
              actionTo="/planning"
            />
          ) : (
            <div className="space-y-4">
              <ChartPanel title="Gasto vs orçamento">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.budgetRows}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis
                        tickFormatter={(v) =>
                          hideBalances ? "•••" : `${v / 100}`
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={moneyTooltip(hideBalances)} />
                      <Bar
                        dataKey="spent"
                        fill="#EF4444"
                        name="Gasto"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="budget"
                        fill="#6366F1"
                        name="Orçamento"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>
              <div className="grid gap-3 md:grid-cols-2">
                {data.budgetRows.map((b) => {
                  const over = b.pct > 100;
                  return (
                    <div
                      key={b.name}
                      className="rounded-2xl border bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{b.name}</span>
                        <span
                          className={cn(
                            "tabular-nums font-semibold",
                            over ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {b.pct.toFixed(0)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        <MoneyText
                          cents={b.spent}
                          hideBalances={hideBalances}
                        />
                        {" / "}
                        <MoneyText
                          cents={b.budget}
                          hideBalances={hideBalances}
                        />
                      </p>
                      <Progress
                        value={Math.min(100, b.pct)}
                        className={cn(
                          "mt-2",
                          over && "[&>div]:bg-destructive",
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function aggregateByCategory(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
) {
  const map = new Map<
    string,
    { name: string; type: string; total: number; count: number }
  >();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const cat = categoryMap.get(tx.categoryId);
    if (!cat) continue;
    const cur = map.get(tx.categoryId) ?? {
      name: cat.name,
      type: cat.type,
      total: 0,
      count: 0,
    };
    cur.total += tx.amount;
    cur.count += 1;
    map.set(tx.categoryId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function aggregateByAccount(
  transactions: Transaction[],
  accounts: { id: string; name: string; color: string }[],
) {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const map = new Map<string, { name: string; total: number; color: string }>();
  for (const tx of transactions) {
    const acc = accountMap.get(tx.accountId);
    if (!acc) continue;
    const cur = map.get(tx.accountId) ?? {
      name: acc.name,
      total: 0,
      color: acc.color,
    };
    cur.total += tx.amount;
    map.set(tx.accountId, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function aggregateMonthly(transactions: Transaction[]) {
  const map = new Map<
    string,
    { month: string; income: number; expense: number }
  >();
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7);
    const cur = map.get(month) ?? { month, income: 0, expense: 0 };
    if (tx.type === "INCOME") cur.income += tx.amount;
    if (tx.type === "EXPENSE") cur.expense += tx.amount;
    map.set(month, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function buildInsights(input: {
  transactions: Transaction[];
  byCategory: { name: string; total: number }[];
  income: number;
  expense: number;
  savingsRate: number;
  budgetRows: { name: string; budget: number; spent: number }[];
  prevIncome: number;
  prevExpense: number;
}): string[] {
  const insights: string[] = [];

  if (input.transactions.length === 0) {
    insights.push("Sem dados para o período selecionado.");
    return insights;
  }

  if (input.byCategory.length > 0 && input.expense > 0) {
    const top = input.byCategory[0];
    const pct = (top.total / input.expense) * 100;
    insights.push(
      `Concentração: ${top.name} representa ${pct.toFixed(0)}% das despesas.`,
    );
  }

  if (input.savingsRate >= 20) {
    insights.push(
      `Excelente taxa de poupança de ${input.savingsRate.toFixed(0)}%.`,
    );
  } else if (input.income > 0) {
    insights.push(
      `Taxa de poupança de ${input.savingsRate.toFixed(0)}% — há espaço para economizar.`,
    );
  }

  const overBudget = input.budgetRows.filter((b) => b.spent > b.budget);
  if (overBudget.length > 0) {
    insights.push(
      `Orçamento estourado em: ${overBudget.map((b) => b.name).join(", ")}.`,
    );
  }

  if (input.prevExpense > 0) {
    const varPct =
      ((input.expense - input.prevExpense) / input.prevExpense) * 100;
    if (Math.abs(varPct) >= 5) {
      insights.push(
        varPct > 0
          ? `Despesas ${varPct.toFixed(0)}% acima do período anterior.`
          : `Despesas ${Math.abs(varPct).toFixed(0)}% abaixo do período anterior.`,
      );
    }
  }

  if (input.prevIncome > 0 && input.income !== input.prevIncome) {
    const varPct =
      ((input.income - input.prevIncome) / input.prevIncome) * 100;
    insights.push(
      varPct >= 0
        ? `Receitas ${varPct.toFixed(0)}% acima do período anterior.`
        : `Receitas ${Math.abs(varPct).toFixed(0)}% abaixo do período anterior.`,
    );
  }

  return insights;
}
