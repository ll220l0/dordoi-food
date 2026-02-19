import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-white/80 bg-white/75 backdrop-blur-2xl shadow-[0_20px_55px_rgba(15,23,42,0.14)] transition-[transform,box-shadow,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
          ? "bg-black text-white ring-1 ring-white/10 shadow-[0_6px_14px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.12)]"
          : "border border-white/70 bg-white/80 text-black/65"
      )}
    >
      {children}
    </div>
  );
}

export function Photo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/5">
      <Image src={src} alt={alt} fill className="object-cover" sizes="80px" />
    </div>
  );
}

export function Button({
  children, onClick, variant="primary", type="button", disabled, className
}: {
  children: ReactNode; onClick?: ()=>void; variant?: "primary"|"secondary"|"ghost"; type?: "button"|"submit"; disabled?: boolean; className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-center leading-none font-semibold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] disabled:opacity-50 disabled:active:scale-100";
  const styles =
    variant === "primary"
      ? "bg-black text-white shadow-[0_16px_30px_rgba(15,23,42,0.3)]"
      : variant === "secondary"
        ? "bg-white text-black border border-black/10"
        : "bg-transparent text-black/70";
  return <button type={type} onClick={onClick} disabled={disabled} className={clsx(base, styles, className)}>{children}</button>;
}
