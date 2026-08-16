const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Converte reais (number) para centavos (integer). */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/** Converte centavos para reais. */
export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatBRL(cents: number, hide = false): string {
  if (hide) return "••••";
  return currencyFormatter.format(fromCents(cents));
}

export function formatNumber(cents: number): string {
  return numberFormatter.format(fromCents(cents));
}

/**
 * Parse digitação em reais (pt-BR).
 * Vazio / inválido → NaN (não força 0, para validação Zod funcionar).
 * Aceita "50", "50,9", "50,90", "1.234,56", "50.90".
 */
export function parseBRLInput(value: string): number {
  const trimmed = value.replace(/\s/g, "").replace(/R\$/gi, "").trim();
  if (!trimmed) return Number.NaN;

  let cleaned = trimmed;
  if (cleaned.includes(",")) {
    // Formato BR: pontos = milhar, vírgula = decimal
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  // Só ponto: trata como decimal (ex.: 50.90)

  const n = Number(cleaned);
  return Number.isNaN(n) ? Number.NaN : n;
}

/**
 * Formata reais para exibição no input (sem R$).
 * Inteiro → "1.234"; com centavos → "1.234,56".
 */
export function formatBRLInput(reais: number): string {
  if (!Number.isFinite(reais)) return "";
  const hasCents = Math.round(reais * 100) % 100 !== 0;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(reais);
}
