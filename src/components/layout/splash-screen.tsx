import { BrandMark } from "@/components/brand-mark";
import { NAV_LABELS } from "@/domain/labels";

export function SplashScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Carregando ${NAV_LABELS.app}`}
    >
      <div className="splash-content flex flex-col items-center gap-6 text-center">
        <BrandMark size="xl" className="splash-logo shadow-xl shadow-primary/30" />

        <div className="splash-text space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {NAV_LABELS.app}
          </h1>
          <p className="text-sm text-muted-foreground">{NAV_LABELS.tagline}</p>
        </div>

        <div className="splash-bar mt-2 h-1 w-28 overflow-hidden rounded-full bg-primary/15">
          <div className="splash-bar-fill h-full w-1/2 rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
