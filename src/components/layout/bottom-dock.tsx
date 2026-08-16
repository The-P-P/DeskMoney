import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  Landmark,
  Tags,
  Target,
  Repeat,
  PieChart,
  TrendingUp,
  BarChart3,
  LineChart,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LABELS } from "@/domain/labels";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionStore, useUiStore } from "@/stores";
import { useQuery } from "@tanstack/react-query";
import {
  accountsRepo,
  categoriesRepo,
  transactionsRepo,
  budgetsRepo,
  goalsRepo,
  recurringRepo,
} from "@/db";

interface NavChild {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: string;
}

interface NavHub {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavChild[];
  tourId?: string;
  shortLabel?: string;
}

const hubs: NavHub[] = [
  {
    label: NAV_LABELS.dashboard,
    shortLabel: "Home",
    to: "/dashboard",
    icon: LayoutDashboard,
    tourId: "nav-dashboard",
  },
  {
    label: NAV_LABELS.finances,
    shortLabel: "Finanças",
    to: "/finances",
    icon: Wallet,
    tourId: "nav-finances",
    children: [
      {
        label: NAV_LABELS.transactions,
        to: "/finances",
        icon: ArrowLeftRight,
        countKey: "transactions",
      },
      {
        label: NAV_LABELS.futures,
        to: "/finances?tab=futures",
        icon: CalendarClock,
      },
      {
        label: NAV_LABELS.accounts,
        to: "/finances?tab=accounts",
        icon: Landmark,
        countKey: "accounts",
      },
      {
        label: NAV_LABELS.categories,
        to: "/finances?tab=categories",
        icon: Tags,
        countKey: "categories",
      },
    ],
  },
  {
    label: NAV_LABELS.planning,
    shortLabel: "Planos",
    to: "/planning",
    icon: Target,
    tourId: "nav-planning",
    children: [
      {
        label: NAV_LABELS.budgets,
        to: "/planning",
        icon: PieChart,
        countKey: "budgets",
      },
      {
        label: NAV_LABELS.goals,
        to: "/planning?tab=goals",
        icon: Target,
        countKey: "goals",
      },
      {
        label: NAV_LABELS.recurring,
        to: "/planning?tab=recurring",
        icon: Repeat,
        countKey: "recurring",
      },
    ],
  },
  {
    label: NAV_LABELS.reports,
    shortLabel: "Relatórios",
    to: "/reports",
    icon: BarChart3,
    tourId: "nav-reports",
    children: [
      {
        label: NAV_LABELS.overview,
        to: "/reports",
        icon: LayoutDashboard,
      },
      {
        label: NAV_LABELS.categories,
        to: "/reports?tab=categories",
        icon: Tags,
      },
      {
        label: NAV_LABELS.trends,
        to: "/reports?tab=trends",
        icon: TrendingUp,
      },
      {
        label: NAV_LABELS.accounts,
        to: "/reports?tab=accounts",
        icon: Landmark,
      },
      {
        label: NAV_LABELS.budgets,
        to: "/reports?tab=budgets",
        icon: LineChart,
      },
    ],
  },
];

function linkActive(pathname: string, search: string, to: string): boolean {
  const [path, qs] = to.split("?");
  if (pathname !== path) return false;
  if (!qs) {
    const tab = new URLSearchParams(search).get("tab");
    return !tab;
  }
  const want = new URLSearchParams(qs);
  const have = new URLSearchParams(search);
  for (const [k, v] of want.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}

function hubActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function HubFlyout({
  hub,
  countMap,
  children,
}: {
  hub: NavHub;
  countMap: Record<string, number>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const location = useLocation();

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const scheduleOpen = () => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpen(true), 150);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={12}
        className="w-52 p-1.5"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {hub.label}
        </div>
        <div className="space-y-0.5">
          {hub.children?.map((child) => {
            const ChildIcon = child.icon;
            const active = linkActive(
              location.pathname,
              location.search,
              child.to,
            );
            const count = child.countKey && countMap[child.countKey];
            return (
              <NavLink
                key={child.to}
                to={child.to}
                viewTransition
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <ChildIcon className="size-4 shrink-0" />
                <span className="flex-1">{child.label}</span>
                {typeof count === "number" && count > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HubButton({
  hub,
  countMap,
  hubRef,
}: {
  hub: NavHub;
  countMap: Record<string, number>;
  hubRef?: (el: HTMLAnchorElement | null) => void;
}) {
  const location = useLocation();
  const Icon = hub.icon;
  const active = hubActive(location.pathname, hub.to);
  const hasChildren = Boolean(hub.children?.length);

  const button = (
    <NavLink
      to={hub.to}
      viewTransition
      data-tour={hub.tourId}
      data-hub-path={hub.to}
      title={hub.label}
      ref={hubRef}
      className={cn(
        "relative z-[1] flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-center transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" />
      <span className="max-w-full truncate text-[10px] font-medium leading-tight">
        {hub.shortLabel ?? hub.label}
      </span>
    </NavLink>
  );

  if (hasChildren) {
    return (
      <HubFlyout hub={hub} countMap={countMap}>
        {button}
      </HubFlyout>
    );
  }

  return button;
}

function DockIconButton({
  label,
  tourId,
  active,
  onClick,
  to,
  children,
}: {
  label: string;
  tourId: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
  children: ReactNode;
}) {
  const className = cn(
    "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
    active
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  );

  const inner = to ? (
    <NavLink
      to={to}
      viewTransition
      data-tour={tourId}
      className={className}
      title={label}
    >
      {children}
    </NavLink>
  ) : (
    <button
      type="button"
      data-tour={tourId}
      onClick={onClick}
      className={className}
      aria-label={label}
    >
      {children}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function HubGroup({ countMap }: { countMap: Record<string, number> }) {
  const location = useLocation();
  const groupRef = useRef<HTMLDivElement>(null);
  const hubEls = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [pill, setPill] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [ready, setReady] = useState(false);

  const activeHub = hubs.find((h) => hubActive(location.pathname, h.to));

  const measure = () => {
    const group = groupRef.current;
    if (!group || !activeHub) {
      setPill(null);
      return;
    }
    const el = hubEls.current.get(activeHub.to);
    if (!el) {
      setPill(null);
      return;
    }
    const g = group.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({
      x: r.left - g.left,
      y: r.top - g.top,
      w: r.width,
      h: r.height,
    });
  };

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [location.pathname, activeHub?.to]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(group);
    for (const el of hubEls.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [location.pathname, activeHub?.to]);

  return (
    <div ref={groupRef} className="relative flex items-center gap-1">
      {pill && (
        <span
          aria-hidden
          className="dock-pill pointer-events-none absolute left-0 top-0 rounded-2xl bg-primary/15"
          style={{
            width: pill.w,
            height: pill.h,
            transform: `translate(${pill.x}px, ${pill.y}px)`,
            transition: ready ? undefined : "none",
          }}
        />
      )}
      {hubs.map((hub) => (
        <HubButton
          key={hub.to}
          hub={hub}
          countMap={countMap}
          hubRef={(el) => {
            if (el) hubEls.current.set(hub.to, el);
            else hubEls.current.delete(hub.to);
          }}
        />
      ))}
    </div>
  );
}

export function BottomDock() {
  const profile = useSessionStore((s) => s.profile);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const location = useLocation();
  const settingsActive =
    location.pathname === "/settings" ||
    location.pathname.startsWith("/settings/");

  const counts = useQuery({
    queryKey: ["nav-counts", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const uid = profile!.id;
      const [accounts, categories, transactions, budgets, goals, recurring] =
        await Promise.all([
          accountsRepo.count(uid),
          categoriesRepo.list(uid),
          transactionsRepo.list(uid),
          budgetsRepo.list(uid),
          goalsRepo.list(uid),
          recurringRepo.list(uid),
        ]);
      return {
        accounts,
        categories: categories.length,
        transactions: transactions.length,
        budgets: budgets.length,
        goals: goals.length,
        recurring: recurring.length,
      };
    },
  });

  const countMap = counts.data ?? {};

  return (
    <nav
      data-tour="bottom-dock"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
      style={{ viewTransitionName: "app-dock" }}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-full border px-2 py-1.5",
          "border-black/5 bg-card/70 shadow-lg shadow-black/10 backdrop-blur-xl",
          "dark:border-white/10 dark:bg-card/60 dark:shadow-black/40",
        )}
      >
        <DockIconButton
          label={`${NAV_LABELS.palette} · Ctrl+K`}
          tourId="search-chip"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="size-5" />
        </DockIconButton>

        <div className="mx-0.5 h-8 w-px shrink-0 bg-border/60" />

        <HubGroup countMap={countMap} />

        <div className="mx-0.5 h-8 w-px shrink-0 bg-border/60" />

        <DockIconButton
          label={NAV_LABELS.settings}
          tourId="nav-settings"
          to="/settings"
          active={settingsActive}
        >
          <Settings className="size-5" />
        </DockIconButton>
      </div>
    </nav>
  );
}
