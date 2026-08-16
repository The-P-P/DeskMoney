import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { transactionSchema, type TransactionInput } from "@/domain/schemas";
import { TRANSACTION_TYPE_LABELS } from "@/domain/labels";
import type { Account, Category, Transaction } from "@/domain/types";
import { transactionsRepo } from "@/db";
import { formatDate, todayIso, yesterdayIso } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";
import { useUserId } from "@/features/shared/use-user-id";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  defaultAccountId?: string | null;
  defaultCategoryId?: string | null;
  defaultType?: "INCOME" | "EXPENSE";
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
  defaultAccountId,
  defaultCategoryId,
  defaultType = "EXPENSE",
}: TransactionDialogProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const isEdit = Boolean(transaction);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      amount: 0,
      description: "",
      notes: "",
      date: todayIso(),
      accountId: defaultAccountId ?? accounts[0]?.id ?? "",
      categoryId: defaultCategoryId ?? null,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      form.reset({
        type: transaction.type === "TRANSFER" ? "EXPENSE" : transaction.type,
        amount: fromCents(transaction.amount),
        description: transaction.description,
        notes: transaction.notes ?? "",
        date: transaction.date.slice(0, 10),
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
      });
      setNotesOpen(Boolean(transaction.notes));
    } else {
      const type = defaultType;
      const categoryId = defaultCategoryId ?? null;
      const matched =
        categoryId != null
          ? categories.find((c) => c.id === categoryId && c.type === type)
          : null;
      form.reset({
        type,
        amount: 0,
        description: "",
        notes: "",
        date: todayIso(),
        accountId: defaultAccountId ?? accounts[0]?.id ?? "",
        categoryId: matched ? matched.id : null,
      });
      setNotesOpen(false);
    }
    const t = window.setTimeout(() => amountRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [
    open,
    transaction,
    form,
    defaultAccountId,
    defaultCategoryId,
    defaultType,
    accounts,
    categories,
  ]);

  const txType = form.watch("type");
  const filteredCategories = categories.filter((c) => c.type === txType);
  const isIncome = txType === "INCOME";
  const today = todayIso();
  const yesterday = yesterdayIso();

  const mutation = useMutation({
    mutationFn: async (values: TransactionInput) => {
      if (!userId) throw new Error("Sessão inválida");
      const payload = {
        ...values,
        amount: toCents(values.amount),
        notes: values.notes || null,
        categoryId: values.categoryId || null,
      };
      if (isEdit && transaction) {
        return transactionsRepo.update(transaction.id, payload);
      }
      return transactionsRepo.create(userId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["finances-month-stats"] });
      toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    },
  });

  function handleTypeChange(next: "INCOME" | "EXPENSE") {
    const currentCatId = form.getValues("categoryId");
    form.setValue("type", next, { shouldDirty: true });
    if (currentCatId) {
      const cat = categories.find((c) => c.id === currentCatId);
      if (cat && cat.type !== next) {
        form.setValue("categoryId", null);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90vh,720px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0 shadow-2xl sm:max-w-md sm:rounded-2xl",
          "[&>button]:right-4 [&>button]:top-4",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-0 h-36 bg-gradient-to-b to-transparent",
            isIncome
              ? "from-success/20 via-success/5"
              : "from-destructive/20 via-destructive/5",
          )}
        />

        <div className="relative z-10 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6 pt-5">
          <DialogHeader className="space-y-0 pr-8 text-left">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEdit ? "Editar lançamento" : "Novo lançamento"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
              className="space-y-5"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
                      <button
                        type="button"
                        onClick={() => handleTypeChange("EXPENSE")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          field.value === "EXPENSE"
                            ? "bg-destructive/15 text-destructive shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <ArrowDownRight className="size-3.5" />
                        {TRANSACTION_TYPE_LABELS.EXPENSE}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange("INCOME")}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                          field.value === "INCOME"
                            ? "bg-success/15 text-success shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <ArrowUpRight className="size-3.5" />
                        {TRANSACTION_TYPE_LABELS.INCOME}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormControl>
                      <div className="flex items-baseline justify-center gap-1.5">
                        <span
                          className={cn(
                            "select-none text-4xl font-semibold tabular-nums sm:text-5xl",
                            isIncome ? "text-success/70" : "text-destructive/70",
                          )}
                        >
                          R$
                        </span>
                        <MoneyInput
                          ref={(el) => {
                            amountRef.current = el;
                            field.ref(el);
                          }}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          placeholder="0"
                          className={cn(
                            "h-auto w-auto min-w-[3ch] max-w-[14ch] border-0 bg-transparent p-0 text-center text-4xl font-semibold tracking-tight tabular-nums shadow-none sm:text-5xl md:text-5xl",
                            "placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0",
                            isIncome ? "text-success" : "text-destructive",
                          )}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <input
                        {...field}
                        placeholder="O que foi?"
                        className={cn(
                          "w-full border-0 border-b border-border/60 bg-transparent px-0 pb-2 text-base font-medium",
                          "placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none",
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Categoria
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CategoryChip
                        label="Sem categoria"
                        selected={!field.value}
                        onClick={() => field.onChange(null)}
                        icon={Tag}
                      />
                      {filteredCategories.map((cat) => {
                        const Icon = resolveLucideIcon(cat.icon);
                        return (
                          <CategoryChip
                            key={cat.id}
                            label={cat.name}
                            color={cat.color}
                            icon={Icon}
                            selected={field.value === cat.id}
                            onClick={() => field.onChange(cat.id)}
                          />
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap items-center gap-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MetaChip
                          active={field.value === today}
                          onClick={() => field.onChange(today)}
                        >
                          Hoje
                        </MetaChip>
                        <MetaChip
                          active={field.value === yesterday}
                          onClick={() => field.onChange(yesterday)}
                        >
                          Ontem
                        </MetaChip>
                        <MetaChip
                          active={
                            field.value !== today && field.value !== yesterday
                          }
                          onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                        >
                          <Calendar className="size-3.5" />
                          {field.value === today || field.value === yesterday
                            ? "Outra data"
                            : formatDate(field.value, "dd MMM")}
                        </MetaChip>
                        <input
                          ref={dateInputRef}
                          type="date"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => {
                    const selected = accounts.find((a) => a.id === field.value);
                    return (
                      <FormItem className="ml-auto space-y-0">
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger
                              className={cn(
                                "h-8 w-auto gap-2 rounded-full border-border/60 bg-muted/40 px-3 text-xs shadow-none",
                                "focus:ring-1 focus:ring-offset-0",
                              )}
                            >
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    selected?.color ?? "hsl(var(--muted-foreground))",
                                }}
                              />
                              <SelectValue placeholder="Conta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: a.color }}
                                  />
                                  {a.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    {!notesOpen ? (
                      <button
                        type="button"
                        onClick={() => setNotesOpen(true)}
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="size-3.5" />
                        Observações
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setNotesOpen(false)}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ChevronDown className="size-3.5" />
                          Observações
                        </button>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Opcional"
                            autoFocus
                            className="resize-none rounded-xl border-border/60 bg-muted/30"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                      </>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className={cn(
                    "rounded-xl",
                    isIncome
                      ? "bg-success text-white hover:bg-success/90"
                      : "bg-destructive text-white hover:bg-destructive/90",
                  )}
                >
                  {mutation.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryChip({
  label,
  color,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  color?: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
        selected && !color && "border-primary/40 bg-primary/10 text-primary shadow-sm",
        selected && color && "border-transparent shadow-sm",
        !selected &&
          "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      style={
        selected && color
          ? {
              backgroundColor: `${color}22`,
              color,
              boxShadow: `0 0 0 1.5px ${color}`,
            }
          : undefined
      }
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full",
          !color && (selected ? "bg-primary/15" : "bg-muted"),
        )}
        style={color ? { backgroundColor: `${color}33`, color } : undefined}
      >
        <Icon className="size-3" style={color ? { color } : undefined} />
      </span>
      {label}
    </button>
  );
}

function MetaChip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
