import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { LogOut, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { pinSchema, type PinInput } from "@/domain/schemas";
import { EMPTY_STATES, NAV_LABELS, REPORT_PERIOD_LABELS } from "@/domain/labels";
import type { ReportPeriod, ThemeMode, UserPreferences } from "@/domain/types";
import {
  accountsRepo,
  budgetsRepo,
  categoriesRepo,
  deviceRepo,
  goalsRepo,
  logout,
  notificationsRepo,
  profilesRepo,
  recurringRepo,
  transactionsRepo,
} from "@/db";
import { exportLgpdJson } from "@/lib/export";
import { formatDate } from "@/lib/dates";
import { useUserId } from "@/features/shared/use-user-id";
import { useSessionStore, useUiStore } from "@/stores";

export function SettingsPage() {
  const userId = useUserId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useSessionStore((s) => s.profile);
  const preferences = useSessionStore((s) => s.preferences);
  const updatePreferences = useSessionStore((s) => s.updatePreferences);
  const setProfile = useSessionStore((s) => s.setProfile);
  const setTourOpen = useUiStore((s) => s.setTourOpen);
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [pinMode, setPinMode] = useState<"set" | "clear">("set");

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
  }, [profile?.fullName]);

  const accountsQuery = useQuery({
    queryKey: ["accounts", userId],
    enabled: Boolean(userId),
    queryFn: () => accountsRepo.list(userId!),
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: () => notificationsRepo.list(userId!),
  });

  const deviceQuery = useQuery({
    queryKey: ["device-settings"],
    queryFn: () => deviceRepo.getSettings(),
  });

  const pinForm = useForm<PinInput>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "" },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão inválida");
      return profilesRepo.updateProfile(userId, { fullName });
    },
    onSuccess: (updated) => {
      setProfile(updated);
      toast.success("Perfil atualizado");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const savePreferences = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      if (!userId) throw new Error("Sessão inválida");
      return profilesRepo.updatePreferences(userId, prefs);
    },
    onSuccess: (updated) => {
      setProfile(updated);
      toast.success("Preferências salvas");
    },
  });

  async function handleLogout() {
    await logout();
    setProfile(null);
    navigate("/");
    toast.success("Sessão encerrada");
  }

  async function handleThemeChange(mode: ThemeMode) {
    setTheme(mode);
    await deviceRepo.setTheme(mode);
    queryClient.invalidateQueries({ queryKey: ["device-settings"] });
  }

  function patchPreferences(patch: Partial<UserPreferences>) {
    const next = {
      ...preferences,
      ...patch,
      notifications: {
        ...preferences.notifications,
        ...(patch.notifications ?? {}),
      },
    };
    updatePreferences(patch);
    savePreferences.mutate(next);
  }

  async function handleExportLgpd() {
    if (!userId || !profile) return;
    const payload = {
      profile,
      accounts: await accountsRepo.list(userId, { includeArchived: true }),
      categories: await categoriesRepo.list(userId),
      transactions: await transactionsRepo.list(userId),
      budgets: await budgetsRepo.list(userId),
      goals: await goalsRepo.list(userId),
      recurring: await recurringRepo.list(userId),
      notifications: await notificationsRepo.list(userId),
      exportedAt: new Date().toISOString(),
    };
    const ok = await exportLgpdJson(payload);
    if (ok) toast.success("Dados exportados em JSON");
  }

  async function handleDeleteAccount() {
    if (!userId) return;
    await profilesRepo.deleteAllUserData(userId);
    await logout();
    setProfile(null);
    queryClient.clear();
    navigate("/");
    toast.success(profile?.isDemo ? "Dados locais limpos" : "Conta excluída");
  }

  async function handlePinSubmit(values: PinInput) {
    if (pinMode === "set") {
      await deviceRepo.setPin(values.pin);
      toast.success("PIN definido");
    } else {
      const valid = await deviceRepo.verifyPin(values.pin);
      if (!valid) {
        toast.error("PIN incorreto");
        return;
      }
      await deviceRepo.clearPin();
      toast.success("PIN removido");
    }
    pinForm.reset();
    queryClient.invalidateQueries({ queryKey: ["device-settings"] });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsRepo.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsRepo.markAllRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Todas marcadas como lidas");
    },
  });

  const hasPin = Boolean(deviceQuery.data?.pinHash);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">{NAV_LABELS.settings}</h1>
        <p className="text-sm text-muted-foreground">
          Perfil, preferências e privacidade
        </p>
      </div>

      {/* 1. Perfil e conta */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil e conta</CardTitle>
          <CardDescription>Informações básicas da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={profile?.email ?? ""} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Input value={profile?.defaultCurrency ?? "BRL"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Input value={profile?.locale ?? "pt-BR"} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              disabled={profile?.isDemo}
              placeholder={profile?.isDemo ? "Indisponível no modo demo" : "Em breve"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              Salvar perfil
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 size-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Preferências */}
      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ocultar saldos</p>
              <p className="text-xs text-muted-foreground">Mascara valores na interface</p>
            </div>
            <Switch
              checked={preferences.hideBalances}
              onCheckedChange={(v) => patchPreferences({ hideBalances: v })}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Conta padrão</Label>
            <Select
              value={preferences.defaultAccountId ?? "__none__"}
              onValueChange={(v) =>
                patchPreferences({ defaultAccountId: v === "__none__" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {(accountsQuery.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período do dashboard</Label>
              <Select
                value={preferences.dashboardPeriod}
                onValueChange={(v) =>
                  patchPreferences({ dashboardPeriod: v as "month" | "week" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="week">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Início da semana</Label>
              <Select
                value={String(preferences.weekStartsOn)}
                onValueChange={(v) =>
                  patchPreferences({ weekStartsOn: Number(v) as 0 | 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda-feira</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período padrão dos relatórios</Label>
              <Select
                value={preferences.reportDefaultPeriod}
                onValueChange={(v) =>
                  patchPreferences({
                    reportDefaultPeriod: v as Exclude<ReportPeriod, "CUSTOM">,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_PERIOD_LABELS)
                    .filter(([k]) => k !== "CUSTOM")
                    .map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato de exportação</Label>
              <Select
                value={preferences.reportExportFormat}
                onValueChange={(v) =>
                  patchPreferences({ reportExportFormat: v as "csv" | "pdf" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={() => setTourOpen(true)}>
            Repetir tutorial
          </Button>
        </CardContent>
      </Card>

      {/* 3. Aparência */}
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={(theme as ThemeMode) ?? "system"}
            onValueChange={(v) => handleThemeChange(v as ThemeMode)}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 4. Notificações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>Alertas e caixa de entrada</CardDescription>
          </div>
          {(notificationsQuery.data ?? []).some((n) => !n.isRead) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
            >
              Marcar todas como lidas
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Alertas de orçamento</span>
            <Switch
              checked={preferences.notifications.budgetAlerts}
              onCheckedChange={(v) =>
                patchPreferences({
                  notifications: { ...preferences.notifications, budgetAlerts: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Lembretes de recorrência</span>
            <Switch
              checked={preferences.notifications.recurringReminders}
              onCheckedChange={(v) =>
                patchPreferences({
                  notifications: { ...preferences.notifications, recurringReminders: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Progresso de metas</span>
            <Switch
              checked={preferences.notifications.goalProgress}
              onCheckedChange={(v) =>
                patchPreferences({
                  notifications: { ...preferences.notifications, goalProgress: v },
                })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Notificações push</span>
            <Switch
              checked={preferences.notifications.pushEnabled}
              onCheckedChange={(v) =>
                patchPreferences({
                  notifications: { ...preferences.notifications, pushEnabled: v },
                })
              }
            />
          </div>
          <Separator />
          <div className="space-y-2">
            {(notificationsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{EMPTY_STATES.notifications}</p>
            ) : (
              (notificationsQuery.data ?? []).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between rounded-lg border p-3 ${n.isRead ? "opacity-60" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(n.createdAt, "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRead.mutate(n.id)}
                    >
                      Marcar lida
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 5. Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Segurança
          </CardTitle>
          <CardDescription>PIN para visualizar contas arquivadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {hasPin ? "PIN configurado neste dispositivo." : "Nenhum PIN configurado."}
          </p>
          <div className="flex gap-2">
            <Button
              variant={pinMode === "set" ? "default" : "outline"}
              size="sm"
              onClick={() => setPinMode("set")}
            >
              {hasPin ? "Alterar PIN" : "Definir PIN"}
            </Button>
            {hasPin && (
              <Button
                variant={pinMode === "clear" ? "default" : "outline"}
                size="sm"
                onClick={() => setPinMode("clear")}
              >
                Remover PIN
              </Button>
            )}
          </div>
          <Form {...pinForm}>
            <form
              onSubmit={pinForm.handleSubmit(handlePinSubmit)}
              className="flex max-w-xs gap-2"
            >
              <FormField
                control={pinForm.control}
                name="pin"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="sr-only">PIN</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="PIN (mín. 4 dígitos)"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-auto">
                Confirmar
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* 6. Privacidade e LGPD */}
      <Card>
        <CardHeader>
          <CardTitle>Privacidade e LGPD</CardTitle>
          <CardDescription>Exportação e exclusão de dados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={handleExportLgpd}>
            Exportar todos os dados (JSON)
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 size-4" />
                {profile?.isDemo ? "Limpar dados locais" : "Excluir conta"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {profile?.isDemo ? "Limpar dados locais?" : "Excluir conta?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {profile?.isDemo
                    ? "Isso remove o usuário demo e todos os dados associados deste dispositivo. Esta ação não pode ser desfeita."
                    : "Todos os seus dados serão removidos permanentemente deste dispositivo. Esta ação não pode ser desfeita."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
