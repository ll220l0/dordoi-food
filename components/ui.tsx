import clsx from "clsx";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={clsx(
        "rounded-3xl border border-white/85 bg-white/72 backdrop-blur-2xl",
        "shadow-[0_20px_55px_rgba(15,23,42,0.13),0_1.5px_0_rgba(255,255,255,0.95)_inset,0_0_0_0.5px_rgba(255,255,255,0.55)_inset]",
        "transition-[transform,box-shadow,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Pill({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_6px_16px_rgba(249,115,22,0.3),0_1px_0_rgba(255,255,255,0.2)_inset] border border-orange-400/20"
          : "border border-white/70 bg-white/80 text-black/65"
      )}
    >
      {children}
    </div>
  );
}

export function Photo({
  src,
  alt,
  className,
  imgClassName,
  sizes = "96px"
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
}) {
  return (
    <div className={clsx("relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/5", className)}>
      <Image src={src} alt={alt} fill className={clsx("object-cover", imgClassName)} sizes={sizes} />
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "food";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-center leading-none font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.978] disabled:opacity-50 disabled:active:scale-100";

  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white shadow-[0_14px_28px_rgba(15,23,42,0.28),0_1px_0_rgba(255,255,255,0.10)_inset] hover:shadow-[0_18px_34px_rgba(15,23,42,0.34)]"
      : variant === "food"
        ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-[0_10px_24px_rgba(249,115,22,0.34),0_1px_0_rgba(255,255,255,0.22)_inset] border border-orange-400/20 hover:shadow-[0_14px_30px_rgba(249,115,22,0.44)]"
        : variant === "secondary"
          ? "bg-white/90 text-slate-800 border border-black/10 shadow-[0_4px_14px_rgba(15,23,42,0.07),0_1px_0_rgba(255,255,255,0.9)_inset] hover:bg-white hover:shadow-[0_6px_18px_rgba(15,23,42,0.10)]"
          : "bg-transparent text-black/70";

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={clsx(base, styles, className)}>
      {children}
    </button>
  );
}
