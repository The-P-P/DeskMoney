import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Tags,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
  EMPTY_STATES,
  NAV_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/domain/labels";
import type { Account, Category, Transaction } from "@/domain/types";
import {
  accountsRepo,
  categoriesRepo,
  deviceRepo,
  recurringRepo,
  transactionsRepo,
} from "@/db";
import { formatDate, monthRange, todayIso } from "@/lib/dates";
import { AccountDialog } from "@/features/finances/account-dialog";
import { AccountStatement } from "@/features/finances/account-statement";
import { CategoryDialog } from "@/features/finances/category-dialog";
import { CategoryStatement } from "@/features/finances/category-statement";
import { PinDialog } from "@/features/finances/pin-dialog";
import { TransactionDialog } from "@/features/finances/transaction-dialog";
import { EmptyCta } from "@/features/shared/empty-cta";
import { useHideBalances, useUserId } from "@/features/shared/use-user-id";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores";

type FinancesTab = "transactions" | "futures" | "accounts" | "categories";

function tabFromSearch(tab: string | null): FinancesTab {
  if (tab === "futures" || tab === "accounts" || tab === "categories") return tab;
  return "transactions";
}

export function FinancesPage() {
  const userId = useUserId();
  const hideBalances = useHideBalances();
  const defaultAccountId = useSessionStore((s) => s.preferences.defaultAccountId);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const tab = tabFromSearch(searchParams.get("tab"));
  const createParam = searchParams.get("create") === "1";
  const categoryParam = searchParams.get("category");
  const accountParam = searchParams.get("account");

  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txDefaults, setTxDefaults] = useState<{
    accountId?: string | null;
    categoryId?: string | null;
    type?: "INCOME" | "EXPENSE";
  }>({});
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<
    "INCOME" | "EXPENSE" | "ALL"
  >("ALL");

  const { start, end } = monthRange();

  useEffect(() => {
    if (createParam) {
      setEditingTx(null);
      setTxDefaults({});
      setTxDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [createParam, searchParams, setSearchParams]);

  useEffect(() => {
    deviceRepo.isArchivedUnlocked().then(setShowArchived);
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["accounts", userId, showArchived],
    enabled: Boolean(userId),
    queryFn: () => accountsRepo.list(userId!, { includeArchived: showArchived }),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories", userId],
    enabled: Boolean(userId),
    queryFn: () => categoriesRepo.list(userId!),
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", userId],
    enabled: Boolean(userId),
    queryFn: () => transactionsRepo.list(userId!),
  });

  const monthStatsQuery = useQuery({
    queryKey: ["finances-month-stats", userId, start, end],
    enabled: Boolean(userId),
    queryFn: async () => {
      const uid = userId!;
      const [income, expense] = await Promise.all([
        transactionsRepo.sumByType(uid, "INCOME", start, end),
        transactionsRepo.sumByType(uid, "EXPENSE", start, end),
      ]);
      return { income, expense, net: income - expense };
    },
  });

  const futuresQuery = useQuery({
    queryKey: ["futures", userId],
    enabled: Boolean(userId) && tab === "futures",
    queryFn: async () => {
      const uid = userId!;
      const today = todayIso();
      const txs = await transactionsRepo.list(uid);
      const futureTx = txs.filter((t) => t.date.slice(0, 10) > today);
      const projected = await recurringRepo.projectFutures(uid);
      return { futureTx, projected };
    },
  });

  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];
  const monthStats = monthStatsQuery.data;
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const selectedCategory = useMemo(() => {
    if (!categoryParam || tab !== "categories") return null;
    return categoryMap.get(categoryParam) ?? null;
  }, [categoryParam, tab, categoryMap]);

  const selectedAccountFromList = useMemo(() => {
    if (!accountParam || tab !== "accounts") return null;
    return accountMap.get(accountParam) ?? null;
  }, [accountParam, tab, accountMap]);

  const archivedAccountQuery = useQuery({
    queryKey: ["account", accountParam],
    enabled:
      Boolean(accountParam) &&
      tab === "accounts" &&
      !selectedAccountFromList &&
      !accountsQuery.isLoading,
    queryFn: () => accountsRepo.getById(accountParam!),
  });

  const selectedAccount =
    selectedAccountFromList ?? archivedAccountQuery.data ?? null;

  const monthTotalsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (!tx.categoryId) continue;
      if (tx.date < start || tx.date > end) continue;
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount);
    }
    return map;
  }, [transactions, start, end]);

  useEffect(() => {
    if (tab !== "categories") return;
    if (!categoryParam) return;
    if (categoriesQuery.isLoading) return;
    if (selectedCategory) return;
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    setSearchParams(params, { replace: true });
  }, [
    tab,
    categoryParam,
    selectedCategory,
    categoriesQuery.isLoading,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (tab !== "accounts") return;
    if (!accountParam) return;
    if (accountsQuery.isLoading) return;
    if (selectedAccountFromList) return;
    if (archivedAccountQuery.isLoading) return;
    if (archivedAccountQuery.data) return;
    const params = new URLSearchParams(searchParams);
    params.delete("account");
    setSearchParams(params, { replace: true });
  }, [
    tab,
    accountParam,
    selectedAccountFromList,
    accountsQuery.isLoading,
    archivedAccountQuery.isLoading,
    archivedAccountQuery.data,
    searchParams,
    setSearchParams,
  ]);

  const futuresSummary = useMemo(() => {
    if (!futuresQuery.data) return null;
    const items = [
      ...futuresQuery.data.futureTx.map((t) => ({
        amount: t.amount,
        type: t.type === "TRANSFER" ? ("EXPENSE" as const) : t.type,
      })),
      ...futuresQuery.data.projected.map((p) => ({
        amount: p.amount,
        type: p.type,
      })),
    ];
    const inSum = items
      .filter((i) => i.type === "INCOME")
      .reduce((s, i) => s + i.amount, 0);
    const outSum = items
      .filter((i) => i.type === "EXPENSE")
      .reduce((s, i) => s + i.amount, 0);
    return {
      count: items.length,
      income: inSum,
      expense: outSum,
    };
  }, [futuresQuery.data]);

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

  const archiveAccount = useMutation({
    mutationFn: (id: string) => accountsRepo.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta arquivada");
    },
  });

  const restoreAccount = useMutation({
    mutationFn: (id: string) => accountsRepo.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Conta restaurada");
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => accountsRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Conta excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => categoriesRepo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("Categoria excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  function setTab(next: FinancesTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "transactions") params.delete("tab");
    else params.set("tab", next);
    if (next !== "categories") params.delete("category");
    if (next !== "accounts") params.delete("account");
    setSearchParams(params);
  }

  function openCategory(id: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "categories");
    params.set("category", id);
    setSearchParams(params);
  }

  function clearCategory() {
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    setSearchParams(params);
  }

  function openAccount(id: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", "accounts");
    params.set("account", id);
    setSearchParams(params);
  }

  function clearAccount() {
    const params = new URLSearchParams(searchParams);
    params.delete("account");
    setSearchParams(params);
  }

  function openNewTransaction(defaults?: {
    accountId?: string | null;
    categoryId?: string | null;
    type?: "INCOME" | "EXPENSE";
  }) {
    setEditingTx(null);
    setTxDefaults(defaults ?? {});
    setTxDialogOpen(true);
  }

  function openEditTransaction(tx: Transaction) {
    setEditingTx(tx);
    setTxDefaults({});
    setTxDialogOpen(true);
  }

  async function toggleArchived() {
    if (showArchived) {
      setShowArchived(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      return;
    }
    const unlocked = await deviceRepo.isArchivedUnlocked();
    if (unlocked) {
      setShowArchived(true);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } else {
      setPinOpen(true);
    }
  }

  const filteredCategories =
    categoryTypeFilter === "ALL"
      ? categories
      : categories.filter((c) => c.type === categoryTypeFilter);

  const primaryAction =
    tab === "transactions" && accounts.length > 0
      ? {
          label: "Novo lançamento",
          onClick: () => openNewTransaction(),
        }
      : tab === "accounts" && !selectedAccount
        ? {
            label: "Nova conta",
            onClick: () => {
              setEditingAccount(null);
              setAccountDialogOpen(true);
            },
          }
        : tab === "categories" && !selectedCategory
          ? {
              label: "Nova categoria",
              onClick: () => {
                setEditingCategory(null);
                setCategoryDialogOpen(true);
              },
            }
          : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {NAV_LABELS.finances}
          </h2>
          <p className="text-sm text-muted-foreground">
            Lançamentos, futuros, contas e categorias
          </p>
        </div>
        {primaryAction && (
          <Button onClick={primaryAction.onClick}>
            <Plus className="size-4" />
            {primaryAction.label}
          </Button>
        )}
      </div>

      {tab === "transactions" && monthStats && (
        <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-5">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowUpRight className="size-3.5 text-success" />
              Receitas do mês
            </p>
            <p className="text-xl font-semibold text-success">
              <MoneyText cents={monthStats.income} hideBalances={hideBalances} />
            </p>
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowDownRight className="size-3.5 text-destructive" />
              Despesas do mês
            </p>
            <p className="text-xl font-semibold text-destructive">
              <MoneyText
                cents={monthStats.expense}
                hideBalances={hideBalances}
              />
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Fluxo</p>
            <p
              className={cn(
                "text-xl font-semibold",
                monthStats.net >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {hideBalances ? (
                <MoneyText cents={monthStats.net} hideBalances />
              ) : (
                <>
                  {monthStats.net >= 0 ? "+" : "−"}
                  <MoneyText cents={Math.abs(monthStats.net)} />
                </>
              )}
            </p>
          </div>
        </section>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as FinancesTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/50 p-1 sm:w-auto">
          <TabsTrigger
            value="transactions"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            {NAV_LABELS.transactions}
          </TabsTrigger>
          <TabsTrigger
            value="futures"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <CalendarClock className="size-3.5" />
            {NAV_LABELS.futures}
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Landmark className="size-3.5" />
            {NAV_LABELS.accounts}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="gap-1.5 rounded-lg px-3 py-1.5 data-[state=active]:shadow-sm"
          >
            <Tags className="size-3.5" />
            {NAV_LABELS.categories}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          {accounts.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.noAccountBlock}
              actionLabel="Ir para contas"
              onAction={() => setTab("accounts")}
            />
          ) : transactions.length === 0 ? (
            <EmptyCta
              message={EMPTY_STATES.transactions}
              actionLabel="Novo lançamento"
              onAction={() => openNewTransaction()}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <ul className="divide-y">
                {transactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId ?? "");
                  return (
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
                          {cat ? ` · ${cat.name}` : ""}
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
                            onClick={() => openEditTransaction(tx)}
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
          )}
        </TabsContent>

        <TabsContent value="futures" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {futuresSummary && futuresSummary.count > 0 ? (
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  {futuresSummary.count} item
                  {futuresSummary.count === 1 ? "" : "s"}
                </span>
                <span className="text-success tabular-nums">
                  +
                  <MoneyText
                    cents={futuresSummary.income}
                    hideBalances={hideBalances}
                  />
                </span>
                <span className="text-destructive tabular-nums">
                  −
                  <MoneyText
                    cents={futuresSummary.expense}
                    hideBalances={hideBalances}
                  />
                </span>
              </div>
            ) : (
              <div />
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/planning?tab=recurring" viewTransition>
                <Repeat className="size-3.5" />
                {NAV_LABELS.recurring}
              </Link>
            </Button>
          </div>

          {!futuresQuery.data ||
          (futuresQuery.data.futureTx.length === 0 &&
            futuresQuery.data.projected.length === 0) ? (
            <EmptyCta
              message={EMPTY_STATES.futures}
              actionLabel="Configurar recorrências"
              actionTo="/planning?tab=recurring"
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <ul className="divide-y">
                {futuresQuery.data.futureTx.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center gap-3 px-4 py-3"
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
                      <p className="truncate font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {
                          TRANSACTION_TYPE_LABELS[
                            tx.type === "TRANSFER" ? "EXPENSE" : tx.type
                          ]
                        }
                        {" · agendado"}
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
                  </li>
                ))}
                {futuresQuery.data.projected.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 bg-muted/20 px-4 py-3"
                  >
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed bg-background text-center">
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        {formatDate(p.date, "MMM")}
                      </span>
                      <span className="text-sm font-semibold leading-none">
                        {formatDate(p.date, "dd")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{p.description}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {NAV_LABELS.projected}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {TRANSACTION_TYPE_LABELS[p.type]}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-medium tabular-nums",
                        p.type === "INCOME"
                          ? "text-success"
                          : "text-destructive",
                      )}
                    >
                      {p.type === "INCOME" ? "+" : "−"}
                      <MoneyText
                        cents={p.amount}
                        hideBalances={hideBalances}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-4 space-y-4">
          {selectedAccount ? (
            <AccountStatement
              account={selectedAccount}
              categoryMap={categoryMap}
              onBack={clearAccount}
              onEditAccount={() => {
                setEditingAccount(selectedAccount);
                setAccountDialogOpen(true);
              }}
              onCreateTransaction={() =>
                openNewTransaction({ accountId: selectedAccount.id })
              }
              onEditTransaction={openEditTransaction}
            />
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={toggleArchived}>
                  {showArchived ? (
                    <>
                      <Archive className="size-3.5" />
                      Ocultar arquivadas
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-3.5" />
                      Mostrar arquivadas
                    </>
                  )}
                </Button>
              </div>
              {accounts.length === 0 ? (
                <EmptyCta
                  message={EMPTY_STATES.accounts}
                  actionLabel="Nova conta"
                  onAction={() => setAccountDialogOpen(true)}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {accounts.map((account) => (
                    <AccountTile
                      key={account.id}
                      account={account}
                      hideBalances={hideBalances}
                      onOpen={() => openAccount(account.id)}
                      onEdit={() => {
                        setEditingAccount(account);
                        setAccountDialogOpen(true);
                      }}
                      onArchive={() => archiveAccount.mutate(account.id)}
                      onRestore={() => restoreAccount.mutate(account.id)}
                      onDelete={() => deleteAccount.mutate(account.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4 space-y-4">
          {selectedCategory ? (
            <CategoryStatement
              category={selectedCategory}
              accounts={accounts.filter((a) => !a.isArchived)}
              accountMap={accountMap}
              onBack={clearCategory}
              onEditCategory={() => {
                setEditingCategory(selectedCategory);
                setCategoryDialogOpen(true);
              }}
              onCreateTransaction={() =>
                openNewTransaction({
                  categoryId: selectedCategory.id,
                  type: selectedCategory.type,
                })
              }
              onEditTransaction={openEditTransaction}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted/50 p-1">
                {(["ALL", "EXPENSE", "INCOME"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCategoryTypeFilter(t)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      categoryTypeFilter === t
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "ALL" ? "Todas" : CATEGORY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              {filteredCategories.length === 0 ? (
                <EmptyCta
                  message={EMPTY_STATES.categories}
                  actionLabel="Nova categoria"
                  onAction={() => setCategoryDialogOpen(true)}
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCategories.map((cat) => {
                    const monthTotal = monthTotalsByCategory.get(cat.id) ?? 0;
                    return (
                      <div
                        key={cat.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openCategory(cat.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openCategory(cat.id);
                          }
                        }}
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className="size-9 shrink-0 rounded-xl"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-medium">{cat.name}</p>
                            {cat.isSystem && (
                              <Badge variant="outline" className="text-[10px]">
                                Sistema
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_TYPE_LABELS[cat.type]}
                            {monthTotal > 0 && (
                              <>
                                {" · "}
                                <span
                                  className={cn(
                                    "tabular-nums",
                                    cat.type === "INCOME"
                                      ? "text-success"
                                      : "text-destructive",
                                  )}
                                >
                                  {cat.type === "INCOME" ? "+" : "−"}
                                  <MoneyText
                                    cents={monthTotal}
                                    hideBalances={hideBalances}
                                  />
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                        {!cat.isSystem && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setCategoryDialogOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteCategory.mutate(cat.id)}
                              >
                                <Trash2 className="size-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <TransactionDialog
        open={txDialogOpen}
        onOpenChange={(open) => {
          setTxDialogOpen(open);
          if (!open) setTxDefaults({});
        }}
        transaction={editingTx}
        accounts={accounts.filter((a) => !a.isArchived)}
        categories={categories}
        defaultAccountId={txDefaults.accountId ?? defaultAccountId}
        defaultCategoryId={txDefaults.categoryId}
        defaultType={txDefaults.type}
      />
      <AccountDialog
        open={accountDialogOpen}
        onOpenChange={setAccountDialogOpen}
        account={editingAccount}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
      />
      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSuccess={() => {
          setShowArchived(true);
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }}
      />
    </div>
  );
}

function AccountTile({
  account,
  hideBalances,
  onOpen,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  account: Account;
  hideBalances: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { data: balance = 0 } = useQuery({
    queryKey: ["account-balance", account.id],
    queryFn: () => accountsRepo.balance(account.id),
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        account.isArchived && "opacity-70",
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: account.color }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{account.name}</p>
          <p className="text-xs text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              {account.isArchived ? (
                <DropdownMenuItem onClick={onRestore}>
                  <ArchiveRestore className="size-4" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="size-4" />
                  Arquivar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
        <MoneyText cents={balance} hideBalances={hideBalances} />
      </p>
      {account.isArchived && (
        <Badge variant="secondary" className="mt-2">
          Arquivada
        </Badge>
      )}
    </div>
  );
}
