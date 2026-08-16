import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatBRLInput, parseBRLInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> {
  /** Valor em reais (number do formulário). `undefined` / `NaN` / `0` (sem emptyAsZero) → vazio. */
  value?: number | null;
  /** Emite number em reais, ou `undefined` quando o campo está vazio. */
  onChange?: (value: number | undefined) => void;
  /** Quando true, string vazia emite `0` (ex.: saldo inicial, valor atual da meta). */
  emptyAsZero?: boolean;
}

function displayFromValue(value: number | null | undefined, emptyAsZero: boolean): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value === 0 && !emptyAsZero) return "";
  if (value === 0 && emptyAsZero) return "";
  return formatBRLInput(value);
}

/**
 * Input de dinheiro sem R$ e sem ,00 forçado.
 * Digite "50" → 50 reais; centavos opcionais com vírgula ou ponto.
 */
const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      onBlur,
      onFocus,
      emptyAsZero = false,
      className,
      placeholder = "0",
      ...props
    },
    ref,
  ) => {
    const [text, setText] = React.useState(() => displayFromValue(value, emptyAsZero));
    const focusedRef = React.useRef(false);

    React.useEffect(() => {
      if (focusedRef.current) return;
      setText(displayFromValue(value, emptyAsZero));
    }, [value, emptyAsZero]);

    function emit(raw: string) {
      if (!onChange) return;
      if (!raw.trim()) {
        onChange(emptyAsZero ? 0 : undefined);
        return;
      }
      const n = parseBRLInput(raw);
      onChange(Number.isNaN(n) ? undefined : n);
    }

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        className={cn(className)}
        value={text}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "" && !/^[\d.,\s]*$/.test(next)) return;
          setText(next);
          emit(next);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          const n = parseBRLInput(text);
          if (!text.trim() || Number.isNaN(n)) {
            setText("");
            onChange?.(emptyAsZero ? 0 : undefined);
          } else {
            setText(formatBRLInput(n));
            onChange?.(n);
          }
          onBlur?.(e);
        }}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
