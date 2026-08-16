import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Plus } from "lucide-react";
import { BottomDock } from "@/components/layout/bottom-dock";
import { CommandPalette } from "@/components/layout/command-palette";
import { ShortcutsDialog } from "@/components/layout/shortcuts-dialog";
import { ProductTourHost } from "@/components/layout/product-tour";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NAV_LABELS } from "@/domain/labels";
import { useKeyboardShortcuts } from "@/lib/shortcuts";
import { accountsRepo, profilesRepo } from "@/db";
import { useSessionStore, useUiStore } from "@/stores";

function usePageTitle(): string {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  const accountId = params.get("account");

  const accountQuery = useQuery({
    queryKey: ["account", accountId],
    enabled: Boolean(accountId) && pathname === "/finances" && tab === "accounts",
    queryFn: () => accountsRepo.getById(accountId!),
  });

  if (pathname === "/dashboard") return NAV_LABELS.dashboard;
  if (pathname === "/settings") return NAV_LABELS.settings;

  if (pathname === "/finances") {
    if (tab === "futures") return NAV_LABELS.futures;
    if (tab === "accounts") {
      if (accountId && accountQuery.data?.name) return accountQuery.data.name;
      return NAV_LABELS.accounts;
    }
    if (tab === "categories") return NAV_LABELS.categories;
    return NAV_LABELS.transactions;
  }

  if (pathname === "/planning") {
    if (tab === "goals") return NAV_LABELS.goals;
    if (tab === "recurring") return NAV_LABELS.recurring;
    return NAV_LABELS.budgets;
  }

  if (pathname === "/reports") {
    const tabLabels: Record<string, string> = {
      categories: NAV_LABELS.categories,
      trends: NAV_LABELS.trends,
      accounts: NAV_LABELS.accounts,
      budgets: NAV_LABELS.budgets,
    };
    return tabLabels[tab ?? ""] ?? NAV_LABELS.overview;
  }

  return NAV_LABELS.app;
}

export function AppShell() {
  useKeyboardShortcuts();

  const navigate = useNavigate();
  const pageTitle = usePageTitle();
  const profile = useSessionStore((s) => s.profile);
  const preferences = useSessionStore((s) => s.preferences);
  const updatePreferences = useSessionStore((s) => s.updatePreferences);
  const setTourOpen = useUiStore((s) => s.setTourOpen);

  useEffect(() => {
    if (profile && !preferences.productTourCompleted) {
      const t = window.setTimeout(() => setTourOpen(true), 800);
      return () => window.clearTimeout(t);
    }
  }, [profile?.id, preferences.productTourCompleted, setTourOpen, profile]);

  const toggleHideBalances = async () => {
    if (!profile) return;
    const nextHide = !preferences.hideBalances;
    const nextPreferences = { ...preferences, hideBalances: nextHide };
    updatePreferences({ hideBalances: nextHide });
    await profilesRepo.updatePreferences(profile.id, nextPreferences);
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background p-2">
      <header
        className="relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-card px-4 py-2.5 sm:px-6"
        style={{ viewTransitionName: "app-header" }}
      >
        <div className="flex min-w-0 items-center justify-start">
          {profile?.isDemo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                  title={NAV_LABELS.demo}
                >
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  Demo
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{NAV_LABELS.demo}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <h1
          className="max-w-[40vw] truncate text-center text-lg font-semibold sm:max-w-none"
          style={{ viewTransitionName: "page-title" }}
        >
          {pageTitle}
        </h1>

        <div className="flex shrink-0 items-center justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleHideBalances}
                data-tour="hide-balances"
                aria-label={
                  preferences.hideBalances ? "Mostrar saldos" : "Ocultar saldos"
                }
              >
                {preferences.hideBalances ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {preferences.hideBalances ? "Mostrar saldos" : "Ocultar saldos"}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main
        className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border bg-background p-6 pb-28"
        style={{ viewTransitionName: "page-content" }}
      >
        <Outlet />
      </main>

      <BottomDock />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            data-tour="new-transaction"
            onClick={() =>
              navigate("/finances?create=1", { viewTransition: true })
            }
            className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg shadow-primary/30"
            style={{ viewTransitionName: "app-fab" }}
            aria-label="Novo lançamento"
          >
            <Plus className="size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Novo lançamento · n</TooltipContent>
      </Tooltip>

      <CommandPalette />
      <ShortcutsDialog />
      <ProductTourHost />
    </div>
  );
}
