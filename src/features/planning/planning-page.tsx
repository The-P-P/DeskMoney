import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  PieChart,
  Plus,
  Repeat,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BUDGET_PERIOD_LABELS,
  EMPTY_STATES,
  FREQUENCY_LABELS,
  NAV_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/domain/labels";
import type { Budget, Goal, RecurringTransaction } from "@/domain/types";
import {
  accountsRepo,
  budgetsRepo,
  categoriesRepo,
  goalsRepo,
  recurringRepo,
} from "@/db";
import { formatDate, monthRange } from "@/lib/dates";
import { BudgetDialog } from "@/features/planning/budget-dialog";
import { GoalDialog } from "@/features/planning/goal-dialog";
import { RecurringDialog } from "@/features/planning/recurring-dialog";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import { cn } from "@/lib/utils";

type PlanningTab = "budgets" | "goals" | "recurring";

function tabFromSearch(tab: string | null): PlanningTab {
  if (tab === "goals" || tab === "recurring") return tab;
  return "budgets";
}

type BudgetWithSpent = Budget & { spent: number; pct: number };

export function PlanningPage() {
  const userId = useUserId();
  const hideBalances = useHideBalances();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tab = tabFromSearch(searchParams.get("tab"));

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] =
    useState<RecurringTransaction | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories", userId],
    enabled: Boolean(userId),
    queryFn: () => categoriesRepo.list(userId!),
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts", userId],
    enabled: Boolean(userId),
    queryFn: () => accountsRepo.list(userId!),
  });

  const budgetsQuery = useQuery({
    queryKey: ["budgets", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const uid = userId!;
      const list = await budgetsRepo.list(uid);
      const { end } = monthRange();
      return Promise.all(
        list.map(async (b) => {
          const spent = await budgetsRepo.spentInPeriod(
            b.categoryId,
            b.startDate.slice(0, 10),
            (b.endDate ?? end).slice(0, 10),
          );
          const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
          return { ...b, spent, pct } satisfies BudgetWithSpent;
        }),
      );
    },
  });

  const goalsQuery = useQuery({
    queryKey: ["goals", userId],
    enabled: Boolean(userId),
    queryFn: () => goalsRepo.list(userId!),
  });

  const recurringQuery = useQuery({
    queryKey: ["recurring", userId],
    enabled: Boolean(userId),
    queryFn: () => recurringRepo.list(userId!),
  });

  const categories = categoriesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const recurring = recurringQuery.data ?? [];

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  const summary = useMemo(() => {
    const atRisk = budgets.filter((b) => b.pct >= 85).length;
    const over = budgets.filter((b) => b.pct > 100).length;
    const activeGoals = goals.filter((g) => !g.isCompleted);
    const goalPctAvg =
      activeGoals.length > 0
        ? activeGoals.reduce((s, g) => {
            const pct =
              g.targetAmount > 0
                ? Math.min(100, (g.currentAmount / g.targetAmount) * 100)
                : 0;
            return s + pct;
          }, 0) / activeGoals.length
        : 0;
    const activeRecurring = recurring.filter((r) => r.isActive).length;
    return {
      budgets: budgets.length,
      atRisk,
      over,
      goals: activeGoals.length,
      goalPctAvg,
      recurring: activeRecurring,
    };
  }, [budgets, goals, recurring]);

  const deleteBudget = useMutation({
    mutationFn: (id: string) => budgetsRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Orçamento excluído");
    },
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => goalsRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Meta excluída");
    },
  });

  const completeGoal = useMutation({
    mutationFn: (id: string) => goalsRepo.markComplete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Meta concluída!");
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: (id: string) => recurringRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["futures"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Recorrência excluída");
    },
  });

  function setTab(next: PlanningTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "budgets") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params);
  }

  const primaryAction =
    tab === "budgets"
      ? {
          label: "Novo orçamento",
          onClick: () => {
            setEditingBudget(null);
            setBudgetDialogOpen(true);
          },
        }
      : tab === "goals"
        ? {
            label: "Nova meta",
            onClick: () => {
              setEditingGoal(null);
              setGoalDialogOpen(true);
            },
          }
        : {
            label: "Nova recorrência",
            onClick: () => {
              setEditingRecurring(null);
              setRecurringDialogOpen(true);
            },
          };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {NAV_LABELS.planning}
          </h2>
          <p className="text-sm text-muted-foreground">
            Orçamentos, metas e recorrências
          </p>
        </div>
        <Button onClick={primaryAction.onClick}>
          <Plus className="size-4" />
          {primaryAction.label}
        </Button>
      </div>

      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <PieChart className="size-3.5" />
            Orçamentos
          </p>
          <p className="text-xl font-semibold tabular-nums">{summary.budgets}</p>
          {(summary.atRisk > 0 || summary.over > 0) && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs",
                summary.over > 0 ? "text-destructive" : "text-warning",
              )}
            >
              <AlertTriangle className="size-3" />
              {summary.over > 0
                ? `${summary.over} estourado${summary.over === 1 ? "" : "s"}`
                : `${summary.atRisk} em alerta`}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="size-3.5" />
            Metas ativas
          </p>
          <p className="text-xl font-semibold tabular-nums">{summary.goals}</p>
          {summary.goals > 0 && (
            <p className="text-xs text-muted-foreground">
              {summary.goalPctAvg.toFixed(0)}% de progresso médio
            </p>
          )}
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Repeat className="size-3.5" />
            Recorrências
          </p>
          <p className="text-xl font-semibold tabular-nums">
            {summary.recurring}
          </p>
          <p className="text-xs text-muted-foreground">ativas</p>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as PlanningTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/50 p-1 sm:w-auto">
          <TabsTrigger
            value="budgets"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <PieChart className="size-3.5" />
            {NAV_LABELS.budgets}
          </TabsTrigger>
          <TabsTrigger
            value="goals"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Target className="size-3.5" />
            {NAV_LABELS.goals}
          </TabsTrigger>
          <TabsTrigger
            value="recurring"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Repeat className="size-3.5" />
            {NAV_LABELS.recurring}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="mt-4">
          {budgets.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.budgets}
              actionLabel="Criar orçamento"
              onAction={() => setBudgetDialogOpen(true)}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {budgets.map((b) => {
                const cat = categoryMap.get(b.categoryId);
                const over = b.pct > 100;
                const warn = b.pct >= 85 && !over;
                const bar = Math.min(100, b.pct);
                return (
                  <div
                    key={b.id}
                    className="relative overflow-hidden rounded-2xl border bg-card p-4"
                  >
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 h-1",
                        over
                          ? "bg-destructive"
                          : warn
                            ? "bg-warning"
                            : "bg-primary/60",
                      )}
                      style={
                        !over && !warn && cat?.color
                          ? { backgroundColor: cat.color }
                          : undefined
                      }
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {cat?.name ?? "Categoria"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {BUDGET_PERIOD_LABELS[b.period]}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingBudget(b);
                              setBudgetDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteBudget.mutate(b.id)}
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-2">
                      <p className="text-sm tabular-nums text-muted-foreground">
                        <MoneyText
                          cents={b.spent}
                          hideBalances={hideBalances}
                        />
                        <span className="text-muted-foreground/60"> / </span>
                        <MoneyText
                          cents={b.amount}
                          hideBalances={hideBalances}
                        />
                      </p>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          over
                            ? "text-destructive"
                            : warn
                              ? "text-warning"
                              : "text-foreground",
                        )}
                      >
                        {b.pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={bar}
                      className={cn(
                        "mt-2",
                        over && "[&>div]:bg-destructive",
                        warn && "[&>div]:bg-warning",
                      )}
                    />
                    {over && (
                      <Badge variant="destructive" className="mt-3">
                        Orçamento estourado
                      </Badge>
                    )}
                    {warn && (
                      <p className="mt-3 flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="size-3" />
                        Próximo do limite
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          {goals.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.goals}
              actionLabel="Criar meta"
              onAction={() => setGoalDialogOpen(true)}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {goals.map((g) => {
                const pct =
                  g.targetAmount > 0
                    ? Math.min(
                        100,
                        (g.currentAmount / g.targetAmount) * 100,
                      )
                    : 0;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border bg-card p-4",
                      g.isCompleted && "opacity-70",
                    )}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        backgroundColor: g.color || "hsl(var(--primary))",
                      }}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{g.name}</p>
                        {g.deadline && (
                          <p className="text-xs text-muted-foreground">
                            Prazo {formatDate(g.deadline)}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!g.isCompleted && (
                            <DropdownMenuItem
                              onClick={() => completeGoal.mutate(g.id)}
                            >
                              <CheckCircle2 className="size-4" />
                              Marcar concluída
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingGoal(g);
                              setGoalDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteGoal.mutate(g.id)}
                          >
                            <Trash2 className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-2">
                      <p className="text-sm tabular-nums text-muted-foreground">
                        <MoneyText
                          cents={g.currentAmount}
                          hideBalances={hideBalances}
                        />
                        <span className="text-muted-foreground/60"> / </span>
                        <MoneyText
                          cents={g.targetAmount}
                          hideBalances={hideBalances}
                        />
                      </p>
                      <span className="text-sm font-semibold tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={pct} className="mt-2" />
                    {g.isCompleted && (
                      <Badge variant="secondary" className="mt-3">
                        Concluída
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          {recurring.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.recurring}
              actionLabel="Criar recorrência"
              onAction={() => setRecurringDialogOpen(true)}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <ul className="divide-y">
                {recurring.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
                      !r.isActive && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        r.type === "INCOME"
                          ? "bg-success/10 text-success"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {r.type === "INCOME" ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownRight className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{r.description}</p>
                        {!r.isActive && (
                          <Badge variant="outline" className="text-[10px]">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {FREQUENCY_LABELS[r.frequency]}
                        {r.interval > 1 ? ` · a cada ${r.interval}` : ""}
                        {" · "}
                        {accountMap.get(r.accountId) ?? "—"}
                        {" · próxima "}
                        {formatDate(r.nextRunAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          r.type === "INCOME"
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {r.type === "INCOME" ? "+" : "−"}
                        <MoneyText
                          cents={r.amount}
                          hideBalances={hideBalances}
                        />
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {TRANSACTION_TYPE_LABELS[r.type]}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingRecurring(r);
                            setRecurringDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteRecurring.mutate(r.id)}
                        >
                          <Trash2 className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BudgetDialog
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        budget={editingBudget}
        categories={categories}
      />
      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={editingGoal}
      />
      <RecurringDialog
        open={recurringDialogOpen}
        onOpenChange={setRecurringDialogOpen}
        recurring={editingRecurring}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
