import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "error";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function AppUpdateCard() {
  const [version, setVersion] = useState<string>("…");
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const native = isTauriRuntime();

  useEffect(() => {
    if (!native) {
      setVersion("dev (navegador)");
      return;
    }
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion("desconhecida"));
  }, [native]);

  async function handleCheck() {
    if (!native) return;
    setStatus("checking");
    setMessage("");
    setUpdate(null);
    setProgress(0);
    try {
      const next = await check();
      if (!next) {
        setStatus("upToDate");
        setMessage("Você já está na versão mais recente.");
        toast.success("App atualizado");
        return;
      }
      setUpdate(next);
      setStatus("available");
      setMessage(
        next.body?.trim()
          ? `Nova versão ${next.version}: ${next.body.trim()}`
          : `Nova versão ${next.version} disponível.`,
      );
      setConfirmOpen(true);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setMessage(
        text.includes("404") || text.includes("Not Found")
          ? "Nenhuma release publicada ainda. Publique a primeira versão no GitHub."
          : `Não foi possível verificar atualizações: ${text}`,
      );
      toast.error("Falha ao verificar atualizações");
    }
  }

  async function handleInstall() {
    if (!update) return;
    setConfirmOpen(false);
    setStatus("downloading");
    setProgress(0);
    let downloaded = 0;
    let contentLength = 0;
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.min(100, Math.round((downloaded / contentLength) * 100)));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });
      toast.success("Atualização instalada. Reiniciando…");
      await relaunch();
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setMessage(`Falha ao instalar atualização: ${text}`);
      toast.error("Falha ao instalar atualização");
    }
  }

  const busy = status === "checking" || status === "downloading";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" />
            Sobre e atualizações
          </CardTitle>
          <CardDescription>
            Versão instalada e atualização sem baixar o instalador de novo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">BysMoney</p>
            <p className="text-sm text-muted-foreground">Versão {version}</p>
          </div>

          {!native && (
            <p className="text-xs text-muted-foreground">
              A verificação de atualizações só funciona no app nativo (npm run tauri:dev / instalador).
            </p>
          )}

          {message && (
            <p
              className={
                status === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          )}

          {status === "downloading" && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">Baixando… {progress}%</p>
            </div>
          )}

          <Button onClick={() => void handleCheck()} disabled={!native || busy}>
            {status === "checking" ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Verificando…
              </>
            ) : status === "downloading" ? (
              <>
                <Download className="mr-2 size-4" />
                Instalando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 size-4" />
                Verificar atualizações
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Atualizar para {update?.version ?? "nova versão"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {update?.body?.trim() ||
                "O app será baixado, instalado e reiniciado. Seus dados locais serão preservados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleInstall()}>
              Baixar e instalar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
