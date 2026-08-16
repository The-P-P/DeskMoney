import type { LucideIcon } from "lucide-react";
import {
  Book,
  Briefcase,
  Car,
  Heart,
  Home,
  Landmark,
  PiggyBank,
  Repeat,
  Smile,
  Tag,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  book: Book,
  briefcase: Briefcase,
  car: Car,
  heart: Heart,
  home: Home,
  landmark: Landmark,
  "piggy-bank": PiggyBank,
  piggybank: PiggyBank,
  repeat: Repeat,
  smile: Smile,
  tag: Tag,
  target: Target,
  "trending-up": TrendingUp,
  trendingup: TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
};

/** Resolve a string icon name (kebab or camel) to a Lucide component. */
export function resolveLucideIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  const key = name.trim().toLowerCase().replace(/_/g, "-");
  return ICON_MAP[key] ?? ICON_MAP[key.replace(/-/g, "")] ?? Tag;
}
