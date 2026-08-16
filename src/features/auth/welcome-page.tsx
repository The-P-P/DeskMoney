import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND, NAV_LABELS } from "@/domain/labels";
import { enterDemo } from "@/db";
import { useSessionStore } from "@/stores";

export function WelcomePage() {
  const navigate = useNavigate();
  const setProfile = useSessionStore((s) => s.setProfile);
  const [loading, setLoading] = useState(false);

  async function handleDemo() {
    setLoading(true);
    try {
      const profile = await enterDemo();
      setProfile(profile);
      toast.success("Modo demonstração carregado");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entrar na demonstração");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div
            className="mx-auto flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
            style={{ backgroundColor: BRAND.primary }}
          >
            B
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{NAV_LABELS.app}</h1>
            <p className="text-muted-foreground">
              Controle de gastos com experiência premium
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button asChild className="w-full" size="lg">
            <Link to="/signup">{NAV_LABELS.signup}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link to="/login">{NAV_LABELS.login}</Link>
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={handleDemo}
            disabled={loading}
          >
            <Sparkles className="mr-2 size-4" />
            Ver demonstração
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Seus dados ficam no dispositivo. Sem nuvem, sem complicação.
        </p>
      </div>
    </div>
  );
}
