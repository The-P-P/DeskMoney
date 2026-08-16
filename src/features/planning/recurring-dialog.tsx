import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { recurringSchema, type RecurringInput } from "@/domain/schemas";
import { FREQUENCY_LABELS, TRANSACTION_TYPE_LABELS } from "@/domain/labels";
import type { Account, Category, RecurringTransaction } from "@/domain/types";
import { recurringRepo } from "@/db";
import { todayIso } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { useUserId } from "@/features/shared/use-user-id";

type RecurringFormValues = RecurringInput & { isActive: boolean };

interface RecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurring?: RecurringTransaction | null;
  accounts: Account[];
  categories: Category[];
}

export function RecurringDialog({
  open,
  onOpenChange,
  recurring,
  accounts,
  categories,
}: RecurringDialogProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const isEdit = Boolean(recurring);

  const form = useForm<RecurringFormValues>({
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      categoryId: null,
      type: "EXPENSE",
      amount: 0,
      description: "",
      frequency: "MONTHLY",
      interval: 1,
      startDate: todayIso(),
      endDate: null,
      isActive: true,
    },
  });

  const txType = form.watch("type");
  const filteredCategories = categories.filter((c) => c.type === txType);

  useEffect(() => {
    if (!open) return;
    if (recurring) {
      form.reset({
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        type: recurring.type,
        amount: fromCents(recurring.amount),
        description: recurring.description,
        frequency: recurring.frequency,
        interval: recurring.interval,
        startDate: recurring.startDate.slice(0, 10),
        endDate: recurring.endDate?.slice(0, 10) ?? null,
        isActive: recurring.isActive,
      });
    } else {
      form.reset({
        accountId: accounts[0]?.id ?? "",
        categoryId: null,
        type: "EXPENSE",
        amount: 0,
        description: "",
        frequency: "MONTHLY",
        interval: 1,
        startDate: todayIso(),
        endDate: null,
        isActive: true,
      });
    }
  }, [open, recurring, form, accounts]);

  const mutation = useMutation({
    mutationFn: async (values: RecurringFormValues) => {
      if (!userId) throw new Error("Sessão inválida");
      const parsed = recurringSchema.parse({
        accountId: values.accountId,
        categoryId: values.categoryId || null,
        type: values.type,
        amount: values.amount,
        description: values.description,
        frequency: values.frequency,
        interval: values.interval,
        startDate: values.startDate,
        endDate: values.endDate || null,
      });
      const payload = {
        ...parsed,
        amount: toCents(parsed.amount),
        isActive: values.isActive,
      };
      if (isEdit && recurring) {
        return recurringRepo.update(recurring.id, payload);
      }
      return recurringRepo.create(userId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["futures"] });
      toast.success(isEdit ? "Recorrência atualizada" : "Recorrência criada");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as "INCOME" | "EXPENSE")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">{TRANSACTION_TYPE_LABELS.INCOME}</SelectItem>
                <SelectItem value="EXPENSE">{TRANSACTION_TYPE_LABELS.EXPENSE}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição</label>
            <Input {...form.register("description")} placeholder="Ex.: Aluguel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor</label>
              <MoneyInput
                value={form.watch("amount")}
                onChange={(v) => form.setValue("amount", v as number, { shouldValidate: true })}
                placeholder="Ex.: 50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Intervalo (1–30)</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                {...form.register("interval", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Frequência</label>
            <Select
              value={form.watch("frequency")}
              onValueChange={(v) =>
                form.setValue("frequency", v as RecurringInput["frequency"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Conta</label>
            <Select
              value={form.watch("accountId")}
              onValueChange={(v) => form.setValue("accountId", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select
              value={form.watch("categoryId") ?? "__none__"}
              onValueChange={(v) => form.setValue("categoryId", v === "__none__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem categoria</SelectItem>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Início</label>
              <Input type="date" {...form.register("startDate")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fim</label>
              <Input
                type="date"
                value={form.watch("endDate") ?? ""}
                onChange={(e) => form.setValue("endDate", e.target.value || null)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium">Ativa</span>
            <Switch
              checked={form.watch("isActive")}
              onCheckedChange={(v) => form.setValue("isActive", v)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
