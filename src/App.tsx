import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import { useEffect } from "react";
import { useSessionStore } from "@/stores";
import { getCurrentSession } from "@/db";
import { SplashScreen } from "@/components/layout/splash-screen";
import { AppShell } from "@/components/layout/app-shell";
import { WelcomePage } from "@/features/auth/welcome-page";
import { LoginPage } from "@/features/auth/login-page";
import { SignupPage } from "@/features/auth/signup-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { FinancesPage } from "@/features/finances/finances-page";
import { PlanningPage } from "@/features/planning/planning-page";
import { ReportsPage } from "@/features/reports/reports-page";
import { SettingsPage } from "@/features/settings/settings-page";

const SPLASH_MIN_MS = 900;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function Bootstrapped({ children }: { children: React.ReactNode }) {
  const ready = useSessionStore((s) => s.ready);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setReady = useSessionStore((s) => s.setReady);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [session] = await Promise.all([
          getCurrentSession()
            .then((profile) => ({ ok: true as const, profile }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          sleep(SPLASH_MIN_MS),
        ]);
        if (cancelled) return;
        if (session.ok) {
          setProfile(session.profile);
        } else {
          console.error(session.err);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProfile, setReady]);

  if (!ready) {
    return <SplashScreen />;
  }

  return children;
}

function RequireAuth() {
  const profile = useSessionStore((s) => s.profile);
  if (!profile) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const profile = useSessionStore((s) => s.profile);
  if (profile) return <Navigate to="/dashboard" replace />;
  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfAuth>
        <WelcomePage />
      </RedirectIfAuth>
    ),
  },
  {
    path: "/login",
    element: (
      <RedirectIfAuth>
        <LoginPage />
      </RedirectIfAuth>
    ),
  },
  {
    path: "/signup",
    element: (
      <RedirectIfAuth>
        <SignupPage />
      </RedirectIfAuth>
    ),
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "finances", element: <FinancesPage /> },
          { path: "planning", element: <PlanningPage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "/transactions", element: <Navigate to="/finances" replace /> },
  {
    path: "/accounts",
    element: <Navigate to="/finances?tab=accounts" replace />,
  },
  {
    path: "/categories",
    element: <Navigate to="/finances?tab=categories" replace />,
  },
  { path: "/budgets", element: <Navigate to="/planning" replace /> },
  {
    path: "/goals",
    element: <Navigate to="/planning?tab=goals" replace />,
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <Bootstrapped>
      <RouterProvider router={router} />
    </Bootstrapped>
  );
}
