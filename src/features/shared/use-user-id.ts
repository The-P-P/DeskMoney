import { useSessionStore } from "@/stores";

export function useUserId(): string | null {
  return useSessionStore((s) => s.profile?.id ?? null);
}

export function usePreferences() {
  return useSessionStore((s) => s.preferences);
}

export function useHideBalances(): boolean {
  return useSessionStore((s) => s.preferences.hideBalances);
}
