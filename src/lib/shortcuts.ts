import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/stores";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);

  useEffect(() => {
    let pendingG = false;
    let clearTimer: number | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "?" && !mod) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key.toLowerCase() === "n" && !mod && !pendingG) {
        e.preventDefault();
        navigate("/finances?create=1", { viewTransition: true });
        return;
      }

      if (pendingG) {
        pendingG = false;
        window.clearTimeout(clearTimer);
        const key = e.key.toLowerCase();
        const map: Record<string, string> = {
          d: "/dashboard",
          f: "/finances",
          p: "/planning",
          r: "/reports",
          s: "/settings",
        };
        if (map[key]) {
          e.preventDefault();
          navigate(map[key], { viewTransition: true });
        }
        return;
      }

      if (e.key.toLowerCase() === "g" && !mod) {
        pendingG = true;
        clearTimer = window.setTimeout(() => {
          pendingG = false;
        }, 800);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(clearTimer);
    };
  }, [navigate, setPaletteOpen, setShortcutsOpen]);
}
