import { cn } from "@/lib/utils";
import { NAV_LABELS } from "@/domain/labels";
import logoUrl from "@/assets/logo.svg";

const SIZE_CLASS = {
  sm: "size-8",
  md: "size-12",
  lg: "size-16",
  xl: "size-24",
} as const;

const SIZE_PX = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

export type BrandMarkSize = keyof typeof SIZE_CLASS;

interface BrandMarkProps {
  size?: BrandMarkSize;
  className?: string;
  alt?: string;
}

export function BrandMark({
  size = "md",
  className,
  alt = NAV_LABELS.app,
}: BrandMarkProps) {
  const px = SIZE_PX[size];
  return (
    <img
      src={logoUrl}
      alt={alt}
      width={px}
      height={px}
      className={cn(
        SIZE_CLASS[size],
        "shrink-0 rounded-[22%] shadow-lg shadow-primary/25",
        className,
      )}
      draggable={false}
    />
  );
}
