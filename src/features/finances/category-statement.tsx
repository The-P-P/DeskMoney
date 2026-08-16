import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  MoreHorizontal,
  Pencil,
  Plus,
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
import {
  CATEGORY_TYPE_LABELS,
  EMPTY_STATES,
  NAV_LABELS,
} from "@/domain/labels";
import type { Account, Category, Transaction } from "@/domain/types";
import { transactionsRepo } from "@/db";
import { formatDate } from "@/lib/dates";
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { ComparisonBadge } from "@/features/shared/comparison-badge";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import {
  groupByMonth,
  PERIOD_PILLS,
  resolvePreviousRange,
  resolveStatementRange,
  sumAmounts,
  type StatementPeriod,
} from "@/features/finances/statement-utils";
import { cn } from "@/lib/utils";

interface CategoryStatementProps {
  category: Category;
  accounts: Account[];
  accountMap: Map<string, Account>;
  onBack: () => void;
  onEditCategory: () => void;
  onCreateTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

export function CategoryStatement({
  category,
  accounts,
  accountMap,
  onBack,
  onEditCategory,
  onCreateTransaction,
  onEditTransaction,
}: CategoryStatementProps) {
  const userId = useUserId();
  const hideBalances = useHideBalances();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<StatementPeriod>("THIS_MONTH");

  const range = resolveStatementRange(period);
  const prevRange = resolvePreviousRange(period);

  const Icon = resolveLucideIcon(category.icon);
  const isExpense = category.type === "EXPENSE";

  const listQuery = useQuery({
    queryKey: [
      "transactions",
      userId,
      "category",
      category.id,
      period,
      range.start,
      range.end,
    ],
    enabled: Boolean(userId),
    queryFn: () =>
      transactionsRepo.list(userId!, {
        categoryId: category.id,
        start: range.start,
        end: range.end,
      }),
  });

  const prevQuery = useQuery({
    queryKey: [
      "transactions",
      userId,
      "category-prev",
      category.id,
      period,
      prevRange?.start,
      prevRange?.end,
    ],
    enabled: Boolean(userId) && Boolean(prevRange),
    queryFn: () =>
      transactionsRepo.list(userId!, {
        categoryId: category.id,
        start: prevRange!.start,
        end: prevRange!.end,
      }),
  });

  const transactions = listQuery.data ?? [];
  const total = useMemo(() => sumAmounts(transactions), [transactions]);
  const prevTotal = useMemo(
    () => sumAmounts(prevQuery.data ?? []),
    [prevQuery.data],
  );
  const groups = useMemo(() => groupByMonth(transactions), [transactions]);

  const deleteTx = useMutation({
    mutationFn: (id: string) => transactionsRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["finances-month-stats"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Lançamento excluído");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const countLabel =
    transactions.length === 1
      ? "1 lançamento"
      : `${transactions.length} lançamentos`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {NAV_LABELS.categories}
        </Button>
        <div className="flex items-center gap-2">
          {!category.isSystem && (
            <Button variant="outline" size="sm" onClick={onEditCategory}>
              <Pencil className="size-3.5" />
              Editar
            </Button>
          )}
          {accounts.length > 0 && (
            <Button size="sm" onClick={onCreateTransaction}>
              <Plus className="size-3.5" />
              Novo lançamento
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{ backgroundColor: category.color }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-xl font-semibold tracking-tight">
              {category.name}
            </h3>
            {category.isSystem && (
              <Badge variant="outline" className="text-[10px]">
                Sistema
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_TYPE_LABELS[category.type]} · {countLabel}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {isExpense ? (
                <ArrowDownRight className="size-3.5 text-destructive" />
              ) : (
                <ArrowUpRight className="size-3.5 text-success" />
              )}
              {isExpense ? "Despesas do período" : "Receitas do período"}
            </p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                isExpense ? "text-destructive" : "text-success",
              )}
            >
              {isExpense ? "−" : "+"}
              <MoneyText cents={total} hideBalances={hideBalances} />
            </p>
          </div>
          {prevRange && (
            <ComparisonBadge
              current={total}
              previous={prevTotal}
              invert={isExpense}
              compact
            />
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted/50 p-1">
        {PERIOD_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              period === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : transactions.length === 0 ? (
        <EmptyCta
          message={EMPTY_STATES.transactions}
          actionLabel={accounts.length > 0 ? "Novo lançamento" : undefined}
          onAction={accounts.length > 0 ? onCreateTransaction : undefined}
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-medium capitalize text-muted-foreground">
                  {group.label}
                </p>
                <p
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isExpense ? "text-destructive" : "text-success",
                  )}
                >
                  {isExpense ? "−" : "+"}
                  <MoneyText cents={group.total} hideBalances={hideBalances} />
                </p>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-card">
                <ul className="divide-y">
                  {group.items.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          tx.type === "INCOME"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {tx.type === "INCOME" ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowDownRight className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{tx.description}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDate(tx.date)}
                          {" · "}
                          {accountMap.get(tx.accountId)?.name ?? "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-medium tabular-nums",
                          tx.type === "INCOME"
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {tx.type === "INCOME" ? "+" : "−"}
                        <MoneyText
                          cents={tx.amount}
                          hideBalances={hideBalances}
                        />
                      </span>
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
                            onClick={() => onEditTransaction(tx)}
                          >
                            <Pencil className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteTx.mutate(tx.id)}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
