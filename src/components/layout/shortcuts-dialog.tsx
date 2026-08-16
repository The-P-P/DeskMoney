import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUiStore } from "@/stores";

const SHORTCUTS = [
  { keys: "Ctrl+K", label: "Busca rápida" },
  { keys: "g d", label: "Ir para Dashboard" },
  { keys: "g f", label: "Ir para Finanças" },
  { keys: "g p", label: "Ir para Planejamento" },
  { keys: "g r", label: "Ir para Relatórios" },
  { keys: "g s", label: "Ir para Configurações" },
  { keys: "n", label: "Novo lançamento" },
  { keys: "?", label: "Ajuda" },
] as const;

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>
            Use estes atalhos para navegar mais rápido pelo BysMoney.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{shortcut.label}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
