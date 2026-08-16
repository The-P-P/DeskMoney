import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
  type: z.enum(["CASH", "BANK", "CREDIT_CARD", "INVESTMENT", "OTHER"]),
  initialBalance: z.number({ error: "Valor inválido" }),
  color: z.string().min(1, "Cor obrigatória"),
  icon: z.string().min(1, "Ícone obrigatório"),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Informe o nome").max(80, "Máximo 80 caracteres"),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().min(1),
  icon: z.string().min(1),
  parentId: z.string().nullable().optional(),
});

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().gt(0, "Valor deve ser maior que zero"),
  description: z.string().min(1, "Informe a descrição").max(200),
  notes: z.string().optional().nullable(),
  date: z.string().min(1, "Data obrigatória"),
  accountId: z.string().min(1, "Conta obrigatória"),
  categoryId: z.string().nullable().optional(),
});

export const budgetSchema = z.object({
  categoryId: z.string().min(1, "Categoria obrigatória"),
  period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
  amount: z.number().gt(0, "Valor deve ser maior que zero"),
  startDate: z.string().min(1, "Data inicial obrigatória"),
  endDate: z.string().nullable().optional(),
});

export const goalSchema = z.object({
  name: z.string().min(1, "Informe o nome").max(100),
  targetAmount: z.number().gt(0, "Meta deve ser maior que zero"),
  currentAmount: z.number().min(0, "Valor atual não pode ser negativo"),
  deadline: z.string().nullable().optional(),
  color: z.string().min(1),
  icon: z.string().min(1),
});

export const recurringSchema = z.object({
  accountId: z.string().min(1, "Conta obrigatória"),
  categoryId: z.string().nullable().optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().gt(0, "Valor deve ser maior que zero"),
  description: z.string().min(1).max(200),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(30),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const pinSchema = z.object({
  pin: z.string().min(4, "PIN mínimo de 4 caracteres"),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type RecurringInput = z.infer<typeof recurringSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PinInput = z.infer<typeof pinSchema>;
