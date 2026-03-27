import clsx from "clsx";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  className,
  style
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={clsx(
        "rounded-2xl bg-white shadow-card",
        "transition-[transform,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
        "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
        active
          ? "bg-orange-500 text-white shadow-glow"
          : "bg-white text-gray-600 shadow-soft hover:shadow-card"
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
    <div
      className={clsx(
        "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className={clsx("object-cover", imgClassName)}
        sizes={sizes}
      />
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
    "inline-flex items-center justify-center rounded-[14px] px-5 py-3 text-center font-bold leading-none transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";

  const styles =
    variant === "primary" || variant === "food"
      ? "bg-orange-500 text-white shadow-glow hover:bg-orange-600"
      : variant === "secondary"
        ? "bg-white text-gray-700 shadow-soft hover:shadow-card"
        : "bg-transparent text-gray-500 hover:text-gray-900";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(base, styles, className)}
    >
      {children}
    </button>
  );
}
