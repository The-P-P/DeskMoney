import type { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BRAND, NAV_LABELS } from "@/domain/labels";
import type { Category, Transaction } from "@/domain/types";
import { formatDate } from "@/lib/dates";
import { formatBRL as formatBRLRaw } from "@/lib/money";

/** Helvetica/WinAnsi: evita caracteres Unicode que o jsPDF renderiza como lixo (ex.: − → "). */
function formatBRL(cents: number): string {
  return formatBRLRaw(cents)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[\u2000-\u200b\ufeff]/g, " ");
}

function signedBRL(cents: number, mode: "plain" | "expense" | "income" | "net"): string {
  const abs = formatBRL(Math.abs(cents));
  if (mode === "expense") return `- ${abs}`;
  if (mode === "income") return `+ ${abs}`;
  if (mode === "net") return `${cents >= 0 ? "+" : "-"} ${abs}`;
  return formatBRL(cents);
}

export interface PdfReportCategoryRow {
  name: string;
  type: string;
  total: number;
  count: number;
}

export interface PdfReportAccountRow {
  name: string;
  total: number;
  color: string;
}

export interface PdfReportBudgetRow {
  name: string;
  budget: number;
  spent: number;
  pct: number;
}

export interface PdfReportMonthRow {
  month: string;
  income: number;
  expense: number;
}

export interface PdfReportPayload {
  periodLabel: string;
  start: string;
  end: string;
  profileName: string | null;
  accountFilterLabel: string | null;
  categoryFilterLabel: string | null;
  income: number;
  expense: number;
  net: number;
  savingsRate: number;
  avgDailyExpense: number;
  count: number;
  prevIncome: number;
  prevExpense: number;
  prevNet: number;
  insights: string[];
  byCategory: PdfReportCategoryRow[];
  byAccount: PdfReportAccountRow[];
  monthlyTrend: PdfReportMonthRow[];
  budgetRows: PdfReportBudgetRow[];
  transactions: Transaction[];
  categoryMap: Map<string, Category>;
  accountNames: Map<string, string>;
}

type Rgb = [number, number, number];

const COLORS = {
  primary: hexToRgb(BRAND.primary),
  primaryDark: hexToRgb("#4F46E5"),
  income: hexToRgb("#10B981"),
  expense: hexToRgb("#EF4444"),
  muted: hexToRgb("#64748B"),
  border: hexToRgb("#E2E8F0"),
  zebra: hexToRgb("#F8FAFC"),
  cardBg: hexToRgb("#F1F5F9"),
  white: [255, 255, 255] as Rgb,
  ink: hexToRgb("#0F172A"),
  successSoft: hexToRgb("#ECFDF5"),
  dangerSoft: hexToRgb("#FEF2F2"),
};

const MARGIN = 16;
const FOOTER_H = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function setFill(doc: jsPDF, rgb: Rgb) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}

function setStroke(doc: jsPDF, rgb: Rgb) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}

function setText(doc: jsPDF, rgb: Rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPct(value: number | null): string {
  if (value === null) return "-";
  const arrow = value > 0 ? "+" : "";
  return `${arrow}${value.toFixed(0)}%`;
}

function typeLabel(type: Transaction["type"]): string {
  if (type === "INCOME") return "Receita";
  if (type === "EXPENSE") return "Despesa";
  return "Transfer.";
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}...`;
}

function monthLabel(ym: string): string {
  try {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return format(d, "MMM/yy", { locale: ptBR });
  } catch {
    return ym;
  }
}

class PdfReportBuilder {
  private doc: jsPDF;
  private y = MARGIN;
  private page = 1;
  private readonly generatedAt: string;
  private readonly periodRange: string;

  constructor(
    doc: jsPDF,
    private readonly payload: PdfReportPayload,
  ) {
    this.doc = doc;
    this.generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    });
    this.periodRange = `${formatDate(payload.start)} - ${formatDate(payload.end)}`;
  }

  build() {
    this.drawHeader();
    this.drawKpiCards();
    this.drawComparison();
    this.drawInsights();
    this.drawCategories();
    this.drawAccounts();
    this.drawBudgets();
    this.drawTrend();
    this.drawLedger();
    this.applyFooters();
  }

  private contentBottom() {
    return PAGE_H - MARGIN - FOOTER_H;
  }

  private ensureSpace(needed: number) {
    if (this.y + needed > this.contentBottom()) {
      this.newPage();
    }
  }

  private newPage() {
    this.doc.addPage();
    this.page += 1;
    this.y = MARGIN;
  }

  private drawSectionTitle(title: string) {
    this.ensureSpace(14);
    setText(this.doc, COLORS.ink);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text(title, MARGIN, this.y);
    this.y += 2;
    setStroke(this.doc, COLORS.primary);
    this.doc.setLineWidth(0.6);
    this.doc.line(MARGIN, this.y, MARGIN + 28, this.y);
    setStroke(this.doc, COLORS.border);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN + 30, this.y, MARGIN + CONTENT_W, this.y);
    this.y += 7;
  }

  private drawHeader() {
    const headerH = 42;
    setFill(this.doc, COLORS.primary);
    this.doc.rect(0, 0, PAGE_W, headerH, "F");
    setFill(this.doc, COLORS.primaryDark);
    this.doc.rect(0, headerH - 3, PAGE_W, 3, "F");

    // Brand mark (indigo squircle + white B)
    setFill(this.doc, COLORS.white);
    this.doc.roundedRect(MARGIN, 10, 10, 10, 2.2, 2.2, "F");
    setFill(this.doc, COLORS.primary);
    this.doc.roundedRect(MARGIN + 0.6, 10.6, 8.8, 8.8, 1.8, 1.8, "F");
    setText(this.doc, COLORS.white);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.text("B", MARGIN + 3.35, 16.85);

    setText(this.doc, COLORS.white);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.text(NAV_LABELS.app, MARGIN + 13, 14.5);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8);
    this.doc.setTextColor(226, 232, 240);
    this.doc.text(NAV_LABELS.tagline, MARGIN + 13, 19.5);

    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(16);
    setText(this.doc, COLORS.white);
    this.doc.text("Relatório financeiro", MARGIN, 30);

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(226, 232, 240);
    const rightMeta = [
      this.payload.periodLabel,
      this.periodRange,
      `Gerado em ${this.generatedAt}`,
    ];
    let ry = 12;
    for (const line of rightMeta) {
      this.doc.text(line, PAGE_W - MARGIN, ry, { align: "right" });
      ry += 4.5;
    }

    this.y = headerH + 8;

    // Meta strip
    const filters: string[] = [];
    if (this.payload.profileName) filters.push(this.payload.profileName);
    if (this.payload.accountFilterLabel)
      filters.push(`Conta: ${this.payload.accountFilterLabel}`);
    if (this.payload.categoryFilterLabel)
      filters.push(`Categoria: ${this.payload.categoryFilterLabel}`);
    filters.push("Documento confidencial - uso pessoal");

    setFill(this.doc, COLORS.cardBg);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 8, 1.5, 1.5, "F");
    setText(this.doc, COLORS.muted);
    this.doc.setFontSize(7.5);
    this.doc.text(filters.join("  ·  "), MARGIN + 3, this.y + 5.2);
    this.y += 14;
  }

  private drawKpiCards() {
    this.ensureSpace(36);
    const gap = 3;
    const cardW = (CONTENT_W - gap * 3) / 4;
    const cardH = 28;
    const cards: {
      label: string;
      value: string;
      sub: string;
      accent: Rgb;
      soft: Rgb;
    }[] = [
      {
        label: "Receitas",
        value: formatBRL(this.payload.income),
        sub: `${this.payload.count} lançamento${this.payload.count === 1 ? "" : "s"}`,
        accent: COLORS.income,
        soft: COLORS.successSoft,
      },
      {
        label: "Despesas",
        value: formatBRL(this.payload.expense),
        sub: `média ${formatBRL(Math.round(this.payload.avgDailyExpense))}/dia`,
        accent: COLORS.expense,
        soft: COLORS.dangerSoft,
      },
      {
        label: "Fluxo líquido",
        value: signedBRL(this.payload.net, "net"),
        sub: this.payload.net >= 0 ? "Superávit" : "Déficit",
        accent: this.payload.net >= 0 ? COLORS.income : COLORS.expense,
        soft: this.payload.net >= 0 ? COLORS.successSoft : COLORS.dangerSoft,
      },
      {
        label: "Taxa de poupança",
        value: `${this.payload.savingsRate.toFixed(1)}%`,
        sub: "do total de receitas",
        accent: COLORS.primary,
        soft: hexToRgb("#EEF2FF"),
      },
    ];

    cards.forEach((c, i) => {
      const x = MARGIN + i * (cardW + gap);
      setFill(this.doc, c.soft);
      this.doc.roundedRect(x, this.y, cardW, cardH, 2, 2, "F");
      setFill(this.doc, c.accent);
      this.doc.rect(x, this.y, 1.2, cardH, "F");

      setText(this.doc, COLORS.muted);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(c.label.toUpperCase(), x + 4, this.y + 6);

      setText(this.doc, c.accent);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text(truncate(this.doc, c.value, cardW - 8), x + 4, this.y + 14.5);

      setText(this.doc, COLORS.muted);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6.5);
      this.doc.text(truncate(this.doc, c.sub, cardW - 8), x + 4, this.y + 22);
    });

    this.y += cardH + 8;
  }

  private drawComparison() {
    this.ensureSpace(18);
    this.drawSectionTitle("Comparação com o período anterior");

    const items: { label: string; current: number; previous: number; invert?: boolean }[] = [
      { label: "Receitas", current: this.payload.income, previous: this.payload.prevIncome },
      {
        label: "Despesas",
        current: this.payload.expense,
        previous: this.payload.prevExpense,
        invert: true,
      },
      { label: "Fluxo", current: this.payload.net, previous: this.payload.prevNet },
    ];

    const boxW = (CONTENT_W - 6) / 3;
    items.forEach((item, i) => {
      const x = MARGIN + i * (boxW + 3);
      const change = pctChange(item.current, item.previous);
      const up = (change ?? 0) > 0;
      const favorable = item.invert ? !up : up;
      const color =
        change === null || change === 0
          ? COLORS.muted
          : favorable
            ? COLORS.income
            : COLORS.expense;

      setFill(this.doc, COLORS.zebra);
      this.doc.roundedRect(x, this.y, boxW, 14, 1.5, 1.5, "F");

      setText(this.doc, COLORS.muted);
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(item.label, x + 3, this.y + 5);

      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      this.doc.text(formatBRL(item.current), x + 3, this.y + 10.5);

      setText(this.doc, color);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8);
      const pct = formatPct(change);
      this.doc.text(pct, x + boxW - 3, this.y + 10.5, { align: "right" });
    });

    this.y += 20;
  }

  private drawInsights() {
    if (this.payload.insights.length === 0) return;
    this.ensureSpace(12 + this.payload.insights.length * 6);
    this.drawSectionTitle("Insights");

    setFill(this.doc, hexToRgb("#EEF2FF"));
    const boxH = 4 + this.payload.insights.length * 5.5 + 3;
    this.ensureSpace(boxH);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, boxH, 2, 2, "F");

    let iy = this.y + 5;
    for (const text of this.payload.insights) {
      setFill(this.doc, COLORS.primary);
      this.doc.circle(MARGIN + 4, iy - 1, 0.9, "F");
      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      const lines = this.doc.splitTextToSize(text, CONTENT_W - 12) as string[];
      this.doc.text(lines[0] ?? text, MARGIN + 7, iy);
      iy += 5.5;
    }
    this.y += boxH + 6;
  }

  private drawCategories() {
    if (this.payload.byCategory.length === 0) return;
    this.drawSectionTitle("Categorias");

    const expenseRows = this.payload.byCategory.filter((c) => c.type === "EXPENSE");
    const incomeRows = this.payload.byCategory.filter((c) => c.type === "INCOME");
    const expenseTotal = expenseRows.reduce((s, c) => s + c.total, 0);
    const incomeTotal = incomeRows.reduce((s, c) => s + c.total, 0);

    if (expenseRows.length > 0) {
      this.drawCategoryGroup("Despesas", expenseRows, expenseTotal, COLORS.expense);
    }
    if (incomeRows.length > 0) {
      this.drawCategoryGroup("Receitas", incomeRows, incomeTotal, COLORS.income);
    }
  }

  private drawCategoryGroup(
    title: string,
    rows: PdfReportCategoryRow[],
    total: number,
    accent: Rgb,
  ) {
    this.ensureSpace(16);
    setText(this.doc, accent);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.text(title, MARGIN, this.y);
    this.y += 5;

    // header
    this.ensureSpace(8);
    setFill(this.doc, COLORS.cardBg);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 6, 1, 1, "F");
    setText(this.doc, COLORS.muted);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(6.5);
    this.doc.text("Categoria", MARGIN + 2, this.y + 4);
    this.doc.text("Qtd", MARGIN + 78, this.y + 4);
    this.doc.text("%", MARGIN + 95, this.y + 4);
    this.doc.text("Valor", PAGE_W - MARGIN - 2, this.y + 4, { align: "right" });
    this.y += 8;

    const maxTotal = Math.max(...rows.map((r) => r.total), 1);

    for (const row of rows) {
      this.ensureSpace(10);
      const pct = total > 0 ? (row.total / total) * 100 : 0;
      const barW = Math.max(2, (row.total / maxTotal) * 52);

      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(truncate(this.doc, row.name, 48), MARGIN + 2, this.y + 3.5);

      setFill(this.doc, COLORS.border);
      this.doc.roundedRect(MARGIN + 52, this.y + 1.5, 52, 2.5, 0.8, 0.8, "F");
      setFill(this.doc, accent);
      this.doc.roundedRect(MARGIN + 52, this.y + 1.5, barW, 2.5, 0.8, 0.8, "F");

      setText(this.doc, COLORS.muted);
      this.doc.setFontSize(7.5);
      this.doc.text(String(row.count), MARGIN + 78, this.y + 3.5);
      this.doc.text(`${pct.toFixed(0)}%`, MARGIN + 95, this.y + 3.5);

      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(formatBRL(row.total), PAGE_W - MARGIN - 2, this.y + 3.5, {
        align: "right",
      });
      this.y += 8;
    }
    this.y += 4;
  }

  private drawAccounts() {
    if (this.payload.byAccount.length === 0) return;
    this.drawSectionTitle("Contas");

    this.ensureSpace(8);
    setFill(this.doc, COLORS.cardBg);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 6, 1, 1, "F");
    setText(this.doc, COLORS.muted);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(6.5);
    this.doc.text("Conta", MARGIN + 2, this.y + 4);
    this.doc.text("Movimentação", PAGE_W - MARGIN - 2, this.y + 4, {
      align: "right",
    });
    this.y += 8;

    for (const acc of this.payload.byAccount) {
      this.ensureSpace(8);
      const rgb = hexToRgb(acc.color || BRAND.primary);
      setFill(this.doc, rgb);
      this.doc.circle(MARGIN + 4, this.y + 2, 1.4, "F");

      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(truncate(this.doc, acc.name, 100), MARGIN + 8, this.y + 3.2);

      this.doc.setFont("helvetica", "bold");
      this.doc.text(formatBRL(acc.total), PAGE_W - MARGIN - 2, this.y + 3.2, {
        align: "right",
      });
      this.y += 7;
    }
    this.y += 4;
  }

  private drawBudgets() {
    if (this.payload.budgetRows.length === 0) return;
    this.drawSectionTitle("Orçamentos");

    this.ensureSpace(8);
    setFill(this.doc, COLORS.cardBg);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 6, 1, 1, "F");
    setText(this.doc, COLORS.muted);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(6.5);
    this.doc.text("Categoria", MARGIN + 2, this.y + 4);
    this.doc.text("Gasto / Limite", MARGIN + 70, this.y + 4);
    this.doc.text("%", MARGIN + 130, this.y + 4);
    this.doc.text("Status", PAGE_W - MARGIN - 2, this.y + 4, { align: "right" });
    this.y += 8;

    for (const b of this.payload.budgetRows) {
      this.ensureSpace(10);
      const over = b.pct > 100;
      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.text(truncate(this.doc, b.name, 55), MARGIN + 2, this.y + 3.5);

      setText(this.doc, COLORS.muted);
      this.doc.setFontSize(7.5);
      this.doc.text(
        `${formatBRL(b.spent)} / ${formatBRL(b.budget)}`,
        MARGIN + 70,
        this.y + 3.5,
      );

      setText(this.doc, over ? COLORS.expense : COLORS.income);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(`${b.pct.toFixed(0)}%`, MARGIN + 130, this.y + 3.5);

      setText(this.doc, over ? COLORS.expense : COLORS.income);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.text(over ? "Estourado" : "Dentro", PAGE_W - MARGIN - 2, this.y + 3.5, {
        align: "right",
      });

      // progress bar
      this.y += 5;
      setFill(this.doc, COLORS.border);
      this.doc.roundedRect(MARGIN + 2, this.y, CONTENT_W - 4, 1.8, 0.6, 0.6, "F");
      setFill(this.doc, over ? COLORS.expense : COLORS.primary);
      const fillW = Math.min(CONTENT_W - 4, ((Math.min(b.pct, 100) / 100) * (CONTENT_W - 4)));
      this.doc.roundedRect(MARGIN + 2, this.y, fillW, 1.8, 0.6, 0.6, "F");
      this.y += 6;
    }
    this.y += 2;
  }

  private drawTrend() {
    if (this.payload.monthlyTrend.length < 2) return;
    this.drawSectionTitle("Tendência mensal");

    const chartH = 42;
    this.ensureSpace(chartH + 12);
    const data = this.payload.monthlyTrend;
    const maxVal = Math.max(
      ...data.flatMap((d) => [d.income, d.expense]),
      1,
    );
    const groupW = CONTENT_W / data.length;
    const barW = Math.min(6, groupW * 0.28);
    const gap = 1.5;
    const baseY = this.y + chartH;

    // grid lines
    setStroke(this.doc, COLORS.border);
    this.doc.setLineWidth(0.15);
    for (let i = 0; i <= 4; i++) {
      const gy = this.y + (chartH * i) / 4;
      this.doc.line(MARGIN, gy, MARGIN + CONTENT_W, gy);
    }

    data.forEach((d, i) => {
      const cx = MARGIN + i * groupW + groupW / 2;
      const ih = (d.income / maxVal) * chartH;
      const eh = (d.expense / maxVal) * chartH;

      setFill(this.doc, COLORS.income);
      this.doc.roundedRect(cx - barW - gap / 2, baseY - ih, barW, ih, 0.5, 0.5, "F");
      setFill(this.doc, COLORS.expense);
      this.doc.roundedRect(cx + gap / 2, baseY - eh, barW, eh, 0.5, 0.5, "F");

      setText(this.doc, COLORS.muted);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(6);
      this.doc.text(monthLabel(d.month), cx, baseY + 4, { align: "center" });
    });

    // legend
    const legendY = baseY + 10;
    setFill(this.doc, COLORS.income);
    this.doc.circle(MARGIN + 2, legendY, 1.2, "F");
    setText(this.doc, COLORS.muted);
    this.doc.setFontSize(7);
    this.doc.text("Receitas", MARGIN + 5, legendY + 1);
    setFill(this.doc, COLORS.expense);
    this.doc.circle(MARGIN + 32, legendY, 1.2, "F");
    this.doc.text("Despesas", MARGIN + 35, legendY + 1);

    this.y = legendY + 8;
  }

  private drawLedger() {
    this.drawSectionTitle("Extrato de lançamentos");

    if (this.payload.transactions.length === 0) {
      this.ensureSpace(16);
      setFill(this.doc, COLORS.zebra);
      this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 14, 2, 2, "F");
      setText(this.doc, COLORS.muted);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.doc.text(
        "Sem lançamentos no período selecionado.",
        MARGIN + CONTENT_W / 2,
        this.y + 8.5,
        { align: "center" },
      );
      this.y += 20;
      return;
    }

    const cols = {
      date: MARGIN + 2,
      type: MARGIN + 22,
      desc: MARGIN + 40,
      cat: MARGIN + 95,
      acc: MARGIN + 124,
      value: PAGE_W - MARGIN - 2,
    };

    const drawTableHeader = () => {
      this.ensureSpace(8);
      setFill(this.doc, COLORS.primary);
      this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 6.5, 1, 1, "F");
      setText(this.doc, COLORS.white);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6.5);
      this.doc.text("Data", cols.date, this.y + 4.2);
      this.doc.text("Tipo", cols.type, this.y + 4.2);
      this.doc.text("Descrição", cols.desc, this.y + 4.2);
      this.doc.text("Categoria", cols.cat, this.y + 4.2);
      this.doc.text("Conta", cols.acc, this.y + 4.2);
      this.doc.text("Valor", cols.value, this.y + 4.2, { align: "right" });
      this.y += 8;
    };

    drawTableHeader();

    const sorted = [...this.payload.transactions].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    sorted.forEach((tx, idx) => {
      if (this.y + 7 > this.contentBottom()) {
        this.newPage();
        drawTableHeader();
      }

      if (idx % 2 === 0) {
        setFill(this.doc, COLORS.zebra);
        this.doc.rect(MARGIN, this.y - 1.5, CONTENT_W, 6.5, "F");
      }

      const catName = tx.categoryId
        ? (this.payload.categoryMap.get(tx.categoryId)?.name ?? "-")
        : "-";
      const accName = this.payload.accountNames.get(tx.accountId) ?? "-";
      const valueColor =
        tx.type === "INCOME"
          ? COLORS.income
          : tx.type === "EXPENSE"
            ? COLORS.expense
            : COLORS.muted;

      setText(this.doc, COLORS.ink);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(formatDate(tx.date), cols.date, this.y + 2.5);

      setText(this.doc, valueColor);
      this.doc.text(typeLabel(tx.type), cols.type, this.y + 2.5);

      setText(this.doc, COLORS.ink);
      this.doc.text(truncate(this.doc, tx.description || "-", 48), cols.desc, this.y + 2.5);
      this.doc.text(truncate(this.doc, catName, 24), cols.cat, this.y + 2.5);
      this.doc.text(truncate(this.doc, accName, 22), cols.acc, this.y + 2.5);

      this.doc.setFont("helvetica", "bold");
      setText(this.doc, valueColor);
      const valueText =
        tx.type === "EXPENSE"
          ? signedBRL(tx.amount, "expense")
          : tx.type === "INCOME"
            ? signedBRL(tx.amount, "income")
            : formatBRL(tx.amount);
      this.doc.text(valueText, cols.value, this.y + 2.5, { align: "right" });
      this.y += 6.5;
    });

    // Totals footer
    this.ensureSpace(12);
    this.y += 2;
    setFill(this.doc, COLORS.cardBg);
    this.doc.roundedRect(MARGIN, this.y, CONTENT_W, 10, 1.5, 1.5, "F");
    setText(this.doc, COLORS.ink);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8);
    this.doc.text("Totais do período", MARGIN + 3, this.y + 6.2);

    setText(this.doc, COLORS.income);
    this.doc.text(
      `Receitas ${formatBRL(this.payload.income)}`,
      MARGIN + 68,
      this.y + 6.2,
    );
    setText(this.doc, COLORS.expense);
    this.doc.text(
      `Despesas ${formatBRL(this.payload.expense)}`,
      MARGIN + 112,
      this.y + 6.2,
    );
    setText(this.doc, this.payload.net >= 0 ? COLORS.income : COLORS.expense);
    this.doc.text(
      `Fluxo ${signedBRL(this.payload.net, "net")}`,
      PAGE_W - MARGIN - 2,
      this.y + 6.2,
      { align: "right" },
    );
    this.y += 14;
  }

  private applyFooters() {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      setStroke(this.doc, COLORS.border);
      this.doc.setLineWidth(0.3);
      this.doc.line(MARGIN, PAGE_H - MARGIN - 6, PAGE_W - MARGIN, PAGE_H - MARGIN - 6);

      setText(this.doc, COLORS.muted);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.text(
        `${NAV_LABELS.app} · Relatório financeiro`,
        MARGIN,
        PAGE_H - MARGIN - 1.5,
      );
      this.doc.text(this.periodRange, PAGE_W / 2, PAGE_H - MARGIN - 1.5, {
        align: "center",
      });
      this.doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN - 1.5, {
        align: "right",
      });
    }
  }
}

/** Gera o ArrayBuffer do PDF de relatório (sem salvar no disco). */
export async function buildReportPdf(
  payload: PdfReportPayload,
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  new PdfReportBuilder(doc, payload).build();
  return doc.output("arraybuffer");
}
