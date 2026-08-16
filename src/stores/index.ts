import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile, UserPreferences } from "@/domain/types";
import { DEFAULT_PREFERENCES } from "@/domain/types";

interface SessionState {
  profile: Profile | null;
  ready: boolean;
  setProfile: (profile: Profile | null) => void;
  setReady: (ready: boolean) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  preferences: UserPreferences;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  profile: null,
  ready: false,
  preferences: DEFAULT_PREFERENCES,
  setProfile: (profile) =>
    set({
      profile,
      preferences: profile?.preferences ?? DEFAULT_PREFERENCES,
    }),
  setReady: (ready) => set({ ready }),
  updatePreferences: (prefs) => {
    const current = get().preferences;
    const next = {
      ...current,
      ...prefs,
      notifications: {
        ...current.notifications,
        ...(prefs.notifications ?? {}),
      },
    };
    const profile = get().profile;
    set({
      preferences: next,
      profile: profile ? { ...profile, preferences: next } : null,
    });
  },
}));

interface UiState {
  sidebarHidden: boolean;
  toggleSidebar: () => void;
  setSidebarHidden: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarHidden: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarHidden: !s.sidebarHidden })),
      setSidebarHidden: (sidebarHidden) => set({ sidebarHidden }),
      paletteOpen: false,
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      tourOpen: false,
      setTourOpen: (tourOpen) => set({ tourOpen }),
    }),
    {
      name: "bysmoney-ui",
      version: 2,
      partialize: (s) => ({ sidebarHidden: s.sidebarHidden }),
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          sidebarHidden?: boolean;
          sidebarCollapsed?: boolean;
        };
        return {
          sidebarHidden: state.sidebarHidden ?? false,
        };
      },
    },
  ),
);

export interface RecentItem {
  id: string;
  label: string;
  href: string;
  at: number;
}

interface RecentsState {
  items: RecentItem[];
  push: (item: Omit<RecentItem, "at">) => void;
  clear: () => void;
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      items: [],
      push: (item) =>
        set((s) => {
          const filtered = s.items.filter((i) => i.id !== item.id);
          return {
            items: [{ ...item, at: Date.now() }, ...filtered].slice(0, 12),
          };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "bysmoney-recents" },
  ),
);
