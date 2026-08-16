import { useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  CalendarClock,
  Landmark,
  Tags,
  Target,
  PieChart,
  Repeat,
  BarChart3,
  TrendingUp,
  LineChart,
  Settings,
  Plus,
  FileDown,
  Keyboard,
  SunMoon,
  Eye,
  EyeOff,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  ACCOUNT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
  NAV_LABELS,
} from "@/domain/labels";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  accountsRepo,
  categoriesRepo,
  profilesRepo,
  transactionsRepo,
} from "@/db";
import { useRecentsStore, useSessionStore, useUiStore } from "@/stores";

const NAV_ITEMS = [
  {
    id: "nav-dashboard",
    label: NAV_LABELS.dashboard,
    href: "/dashboard",
    icon: LayoutDashboard,
    shortcut: "g d",
  },
  {
    id: "nav-finances",
    label: NAV_LABELS.transactions,
    href: "/finances",
    icon: Wallet,
    shortcut: "g f",
  },
  {
    id: "nav-futures",
    label: NAV_LABELS.futures,
    href: "/finances?tab=futures",
    icon: CalendarClock,
  },
  {
    id: "nav-accounts",
    label: NAV_LABELS.accounts,
    href: "/finances?tab=accounts",
    icon: Landmark,
  },
  {
    id: "nav-categories",
    label: NAV_LABELS.categories,
    href: "/finances?tab=categories",
    icon: Tags,
  },
  {
    id: "nav-planning",
    label: NAV_LABELS.budgets,
    href: "/planning",
    icon: PieChart,
    shortcut: "g p",
  },
  {
    id: "nav-goals",
    label: NAV_LABELS.goals,
    href: "/planning?tab=goals",
    icon: Target,
  },
  {
    id: "nav-recurring",
    label: NAV_LABELS.recurring,
    href: "/planning?tab=recurring",
    icon: Repeat,
  },
  {
    id: "nav-reports",
    label: NAV_LABELS.overview,
    href: "/reports",
    icon: BarChart3,
    shortcut: "g r",
  },
  {
    id: "nav-reports-categories",
    label: `${NAV_LABELS.reports} — ${NAV_LABELS.categories}`,
    href: "/reports?tab=categories",
    icon: Tags,
  },
  {
    id: "nav-reports-trends",
    label: `${NAV_LABELS.reports} — ${NAV_LABELS.trends}`,
    href: "/reports?tab=trends",
    icon: TrendingUp,
  },
  {
    id: "nav-reports-accounts",
    label: `${NAV_LABELS.reports} — ${NAV_LABELS.accounts}`,
    href: "/reports?tab=accounts",
    icon: Landmark,
  },
  {
    id: "nav-reports-budgets",
    label: `${NAV_LABELS.reports} — ${NAV_LABELS.budgets}`,
    href: "/reports?tab=budgets",
    icon: LineChart,
  },
  {
    id: "nav-settings",
    label: NAV_LABELS.settings,
    href: "/settings",
    icon: Settings,
    shortcut: "g s",
  },
] as const;

const ACTION_ICONS: Record<string, LucideIcon> = {
  "action-new-transaction": Plus,
  "action-new-account": Landmark,
  "action-new-goal": Target,
  "action-new-budget": PieChart,
  "action-export-report": FileDown,
};

function resolveRecentIcon(id: string): LucideIcon {
  const nav = NAV_ITEMS.find((item) => item.id === id);
  if (nav) return nav.icon;
  if (id.startsWith("account-")) return Landmark;
  if (id.startsWith("category-")) return Tags;
  if (id.startsWith("transaction-")) return ArrowLeftRight;
  if (ACTION_ICONS[id]) return ACTION_ICONS[id];
  return ArrowLeftRight;
}

function IconChip({
  icon: Icon,
  color,
}: {
  icon?: LucideIcon;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg",
        color ? "text-white shadow-sm" : "bg-muted/70 text-muted-foreground",
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {Icon ? (
        <Icon className="size-3.5" />
      ) : (
        <span className="size-2 rounded-full bg-current opacity-80" />
      )}
    </span>
  );
}

function PaletteItem({
  icon,
  color,
  title,
  subtitle,
  meta,
  shortcut,
  value,
  onSelect,
}: {
  icon?: LucideIcon;
  color?: string;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  shortcut?: string;
  value: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <IconChip icon={icon} color={color} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium leading-tight">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {meta}
      {shortcut ? <CommandShortcut>{shortcut}</CommandShortcut> : null}
    </CommandItem>
  );
}

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useUiStore((s) => s.paletteOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const recents = useRecentsStore((s) => s.items);
  const pushRecent = useRecentsStore((s) => s.push);
  const profile = useSessionStore((s) => s.profile);
  const preferences = useSessionStore((s) => s.preferences);
  const updatePreferences = useSessionStore((s) => s.updatePreferences);
  const { resolvedTheme, setTheme } = useTheme();

  const searchData = useQuery({
    queryKey: ["palette-search", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const uid = profile!.id;
      const [accounts, categories, transactions] = await Promise.all([
        accountsRepo.list(uid),
        categoriesRepo.list(uid),
        transactionsRepo.list(uid),
      ]);
      return { accounts, categories, transactions };
    },
  });

  const go = useCallback(
    (href: string, label: string, id?: string) => {
      navigate(href, { viewTransition: true });
      pushRecent({ id: id ?? href, label, href });
      setPaletteOpen(false);
    },
    [navigate, pushRecent, setPaletteOpen],
  );

  const toggleHideBalances = useCallback(async () => {
    if (!profile) return;
    const nextHide = !preferences.hideBalances;
    const nextPreferences = { ...preferences, hideBalances: nextHide };
    updatePreferences({ hideBalances: nextHide });
    await profilesRepo.updatePreferences(profile.id, nextPreferences);
    setPaletteOpen(false);
  }, [profile, preferences, updatePreferences, setPaletteOpen]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    setPaletteOpen(false);
  }, [resolvedTheme, setTheme, setPaletteOpen]);

  const recentItems = useMemo(() => recents.slice(0, 6), [recents]);

  const { accounts, categories, transactions } = searchData.data ?? {
    accounts: [],
    categories: [],
    transactions: [],
  };

  return (
    <CommandDialog open={open} onOpenChange={setPaletteOpen}>
      <CommandInput placeholder="Buscar páginas, ações ou dados…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {recentItems.length > 0 && (
          <CommandGroup heading="Recentes">
            {recentItems.map((item) => (
              <PaletteItem
                key={item.id}
                value={`recente ${item.label}`}
                icon={resolveRecentIcon(item.id)}
                title={item.label}
                subtitle="Recente"
                onSelect={() => go(item.href, item.label, item.id)}
              />
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ir para">
          {NAV_ITEMS.map((item) => (
            <PaletteItem
              key={item.id}
              value={`ir ${item.label}`}
              icon={item.icon}
              title={item.label}
              subtitle="Página"
              shortcut={"shortcut" in item ? item.shortcut : undefined}
              onSelect={() => go(item.href, item.label, item.id)}
            />
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <PaletteItem
            value="novo lançamento"
            icon={Plus}
            title="Novo lançamento"
            subtitle="Ação rápida"
            shortcut="n"
            onSelect={() =>
              go("/finances?create=1", "Novo lançamento", "action-new-transaction")
            }
          />
          <PaletteItem
            value="nova conta"
            icon={Landmark}
            title="Nova conta"
            subtitle="Ação rápida"
            onSelect={() =>
              go(
                "/finances?tab=accounts&create=1",
                "Nova conta",
                "action-new-account",
              )
            }
          />
          <PaletteItem
            value="nova meta"
            icon={Target}
            title="Nova meta"
            subtitle="Ação rápida"
            onSelect={() =>
              go("/planning?tab=goals&create=1", "Nova meta", "action-new-goal")
            }
          />
          <PaletteItem
            value="novo orçamento"
            icon={PieChart}
            title="Novo orçamento"
            subtitle="Ação rápida"
            onSelect={() =>
              go("/planning?create=1", "Novo orçamento", "action-new-budget")
            }
          />
          <PaletteItem
            value="exportar relatório"
            icon={FileDown}
            title="Exportar relatório"
            subtitle="Ação rápida"
            onSelect={() =>
              go("/reports", "Exportar relatório", "action-export-report")
            }
          />
          <PaletteItem
            value="ver atalhos"
            icon={Keyboard}
            title="Ver atalhos"
            subtitle="Ajuda"
            shortcut="?"
            onSelect={() => {
              setPaletteOpen(false);
              setShortcutsOpen(true);
            }}
          />
          <PaletteItem
            value="alternar tema"
            icon={SunMoon}
            title={`Alternar tema ${resolvedTheme === "dark" ? "claro" : "escuro"}`}
            subtitle="Preferência"
            onSelect={toggleTheme}
          />
          <PaletteItem
            value="ocultar saldos"
            icon={preferences.hideBalances ? Eye : EyeOff}
            title={preferences.hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
            subtitle="Preferência"
            onSelect={toggleHideBalances}
          />
        </CommandGroup>

        {profile && accounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contas">
              {accounts.map((account) => (
                <PaletteItem
                  key={`account-${account.id}`}
                  value={`conta ${account.name}`}
                  icon={Landmark}
                  color={account.color}
                  title={account.name}
                  subtitle={ACCOUNT_TYPE_LABELS[account.type]}
                  onSelect={() =>
                    go(
                      `/finances?tab=accounts&account=${account.id}`,
                      account.name,
                      `account-${account.id}`,
                    )
                  }
                />
              ))}
            </CommandGroup>
          </>
        )}

        {profile && categories.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Categorias">
              {categories.map((category) => (
                <PaletteItem
                  key={`category-${category.id}`}
                  value={`categoria ${category.name}`}
                  icon={Tags}
                  color={category.color}
                  title={category.name}
                  subtitle={CATEGORY_TYPE_LABELS[category.type]}
                  onSelect={() =>
                    go(
                      `/finances?tab=categories&category=${category.id}`,
                      category.name,
                      `category-${category.id}`,
                    )
                  }
                />
              ))}
            </CommandGroup>
          </>
        )}

        {profile && transactions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Lançamentos">
              {transactions.slice(0, 50).map((transaction) => {
                const isIncome = transaction.type === "INCOME";
                const isExpense = transaction.type === "EXPENSE";
                return (
                  <PaletteItem
                    key={`transaction-${transaction.id}`}
                    value={`lançamento ${transaction.description} ${formatBRL(transaction.amount)}`}
                    icon={ArrowLeftRight}
                    title={transaction.description}
                    subtitle={formatDate(transaction.date)}
                    meta={
                      <span
                        className={cn(
                          "ml-auto shrink-0 text-xs tabular-nums font-medium",
                          isIncome && "text-success",
                          isExpense && "text-destructive",
                          !isIncome && !isExpense && "text-muted-foreground",
                        )}
                      >
                        {formatBRL(transaction.amount, preferences.hideBalances)}
                      </span>
                    }
                    onSelect={() =>
                      go(
                        `/finances?transaction=${transaction.id}`,
                        transaction.description,
                        `transaction-${transaction.id}`,
                      )
                    }
                  />
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Preferências">
          <PaletteItem
            value="preferências configurações"
            icon={Settings}
            title={`Ir para ${NAV_LABELS.settings.toLowerCase()}`}
            subtitle="Preferência"
            onSelect={() => go("/settings", NAV_LABELS.settings, "nav-settings")}
          />
        </CommandGroup>
      </CommandList>
      <CommandFooter />
    </CommandDialog>
  );
}
