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
  ACCOUNT_TYPE_LABELS,
  EMPTY_STATES,
  NAV_LABELS,
} from "@/domain/labels";
import type { Account, Category, Transaction } from "@/domain/types";
import { accountsRepo, transactionsRepo } from "@/db";
import { formatDate } from "@/lib/dates";
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import {
  groupByMonth,
  PERIOD_PILLS,
  resolveStatementRange,
  runningBalances,
  type StatementPeriod,
} from "@/features/finances/statement-utils";
import { cn } from "@/lib/utils";

interface AccountStatementProps {
  account: Account;
  categoryMap: Map<string, Category>;
  onBack: () => void;
  onEditAccount: () => void;
  onCreateTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
}

export function AccountStatement({
  account,
  categoryMap,
  onBack,
  onEditAccount,
  onCreateTransaction,
  onEditTransaction,
}: AccountStatementProps) {
  const userId = useUserId();
  const hideBalances = useHideBalances();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<StatementPeriod>("ALL");

  const range = resolveStatementRange(period);
  const Icon = resolveLucideIcon(account.icon);

  const balanceQuery = useQuery({
    queryKey: ["account-balance", account.id],
    queryFn: () => accountsRepo.balance(account.id),
  });

  const allTxQuery = useQuery({
    queryKey: ["transactions", userId, "account-all", account.id],
    enabled: Boolean(userId),
    queryFn: () =>
      transactionsRepo.list(userId!, { accountId: account.id }),
  });

  const listQuery = useQuery({
    queryKey: [
      "transactions",
      userId,
      "account",
      account.id,
      period,
      range.start,
      range.end,
    ],
    enabled: Boolean(userId),
    queryFn: () =>
      transactionsRepo.list(userId!, {
        accountId: account.id,
        start: range.start,
        end: range.end,
      }),
  });

  const transactions = listQuery.data ?? [];
  const allTransactions = allTxQuery.data ?? [];
  const balance = balanceQuery.data ?? 0;

  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (tx.type === "INCOME") income += tx.amount;
      else if (tx.type === "EXPENSE") expense += tx.amount;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const balances = useMemo(
    () => runningBalances(allTransactions, account.initialBalance),
    [allTransactions, account.initialBalance],
  );

  const groups = useMemo(() => groupByMonth(transactions), [transactions]);

  const deleteTx = useMutation({
    mutationFn: (id: string) => transactionsRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
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

  const showInitialBalance = period === "ALL";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          {NAV_LABELS.accounts}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEditAccount}>
            <Pencil className="size-3.5" />
            Editar
          </Button>
          {!account.isArchived && (
            <Button size="sm" onClick={onCreateTransaction}>
              <Plus className="size-3.5" />
              Novo lançamento
            </Button>
          )}
        </div>
      </div>

      {/* Card-style hero */}
      <section
        className="relative overflow-hidden rounded-2xl border text-white shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${account.color} 0%, color-mix(in srgb, ${account.color} 70%, #0f172a) 100%)`,
        }}
      >
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 size-32 rounded-full bg-black/10" />
        <div className="relative space-y-6 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="truncate text-lg font-semibold tracking-tight">
                    {account.name}
                  </h3>
                  {account.isArchived && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-white/20 text-[10px] text-white"
                    >
                      Arquivada
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-white/75">
                  {ACCOUNT_TYPE_LABELS[account.type]} · {countLabel}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">
              Saldo atual
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              <MoneyText cents={balance} hideBalances={hideBalances} />
            </p>
          </div>
        </div>
      </section>

      {/* Period metrics */}
      <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowUpRight className="size-3.5 text-success" />
            Entradas
          </p>
          <p className="text-xl font-semibold text-success">
            <MoneyText
              cents={periodStats.income}
              hideBalances={hideBalances}
            />
          </p>
        </div>
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowDownRight className="size-3.5 text-destructive" />
            Saídas
          </p>
          <p className="text-xl font-semibold text-destructive">
            <MoneyText
              cents={periodStats.expense}
              hideBalances={hideBalances}
            />
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Fluxo</p>
          <p
            className={cn(
              "text-xl font-semibold",
              periodStats.net >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {hideBalances ? (
              <MoneyText cents={periodStats.net} hideBalances />
            ) : (
              <>
                {periodStats.net >= 0 ? "+" : "−"}
                <MoneyText cents={Math.abs(periodStats.net)} />
              </>
            )}
          </p>
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

      {listQuery.isLoading || allTxQuery.isLoading ? (
        <div className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : transactions.length === 0 ? (
        <div className="space-y-4">
          {showInitialBalance && (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <InitialBalanceRow
                cents={account.initialBalance}
                hideBalances={hideBalances}
              />
            </div>
          )}
          <EmptyCta
            message={EMPTY_STATES.transactions}
            actionLabel={!account.isArchived ? "Novo lançamento" : undefined}
            onAction={!account.isArchived ? onCreateTransaction : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const monthNet = group.income - group.expense;
            return (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-xs font-medium capitalize text-muted-foreground">
                    {group.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      monthNet >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {hideBalances ? (
                      <MoneyText cents={monthNet} hideBalances />
                    ) : (
                      <>
                        {monthNet >= 0 ? "+" : "−"}
                        <MoneyText cents={Math.abs(monthNet)} />
                      </>
                    )}
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl border bg-card">
                  <ul className="divide-y">
                    {group.items.map((tx) => {
                      const cat = categoryMap.get(tx.categoryId ?? "");
                      const after = balances.get(tx.id) ?? 0;
                      return (
                        <li
                          key={tx.id}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center">
                            <span className="text-[10px] font-medium uppercase text-muted-foreground">
                              {formatDate(tx.date, "MMM")}
                            </span>
                            <span className="text-sm font-semibold leading-none">
                              {formatDate(tx.date, "dd")}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {tx.description}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {cat?.name ?? "Sem categoria"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={cn(
                                "text-sm font-medium tabular-nums",
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
                            </p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">
                              Saldo{" "}
                              <MoneyText
                                cents={after}
                                hideBalances={hideBalances}
                              />
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
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}

          {showInitialBalance && (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <InitialBalanceRow
                cents={account.initialBalance}
                hideBalances={hideBalances}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InitialBalanceRow({
  cents,
  hideBalances,
}: {
  cents: number;
  hideBalances: boolean;
}) {
  return (
    <div className="flex items-center gap-3 bg-muted/20 px-4 py-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed bg-background text-xs font-medium text-muted-foreground">
        Ini
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Saldo inicial</p>
        <p className="text-xs text-muted-foreground">Abertura da conta</p>
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
        <MoneyText cents={cents} hideBalances={hideBalances} />
      </span>
    </div>
  );
}
