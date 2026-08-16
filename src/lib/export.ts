import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { fromCents } from "@/lib/money";
import type { Category, Transaction } from "@/domain/types";
import {
  buildReportPdf,
  type PdfReportPayload,
} from "@/lib/pdf-report";

export type { PdfReportPayload };

function csvEscape(value: string | number): string {
  const s = String(value);
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function withBom(content: string): string {
  return `\uFEFF${content}`;
}

export async function exportTransactionsCsv(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
  accountNames: Map<string, string>,
): Promise<boolean> {
  const header = [
    "Data",
    "Tipo",
    "Descrição",
    "Valor",
    "Conta",
    "Categoria",
    "Notas",
  ].join(";");
  const rows = transactions.map((t) =>
    [
      t.date.slice(0, 10),
      t.type === "INCOME" ? "Receita" : t.type === "EXPENSE" ? "Despesa" : "Transferência",
      csvEscape(t.description),
      fromCents(t.amount).toFixed(2).replace(".", ","),
      csvEscape(accountNames.get(t.accountId) ?? ""),
      csvEscape(t.categoryId ? (categoryMap.get(t.categoryId)?.name ?? "") : ""),
      csvEscape(t.notes ?? ""),
    ].join(";"),
  );
  const content = withBom([header, ...rows].join("\n"));
  const path = await save({
    defaultPath: `bysmoney-relatorio-lancamentos-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function exportCategoriesCsv(
  rows: { name: string; type: string; total: number; count: number }[],
): Promise<boolean> {
  const header = ["Categoria", "Tipo", "Total", "Qtd"].join(";");
  const body = rows
    .map((r) =>
      [
        csvEscape(r.name),
        r.type === "INCOME" ? "Receita" : "Despesa",
        fromCents(r.total).toFixed(2).replace(".", ","),
        r.count,
      ].join(";"),
    )
    .join("\n");
  const content = withBom([header, body].join("\n"));
  const path = await save({
    defaultPath: `bysmoney-relatorio-categorias-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function exportReportPdf(
  payload: PdfReportPayload,
): Promise<boolean> {
  const path = await save({
    defaultPath: `bysmoney-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return false;
  const data = await buildReportPdf(payload);
  await writeFile(path, new Uint8Array(data));
  return true;
}

export async function exportLgpdJson(payload: unknown): Promise<boolean> {
  const content = JSON.stringify(payload, null, 2);
  const path = await save({
    defaultPath: `bysmoney-dados-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}
