"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstallAppButton } from "@/components/InstallAppButton";

type Props = {
  menuHref: string;
  orderHref?: string | null;
};

export function ClientNav({ menuHref, orderHref }: Props) {
  const pathname = usePathname();
  const resolvedOrderHref = orderHref ?? "/order";

  const itemClassName = (active: boolean) =>
    clsx(
      "rounded-full px-4 py-2 text-sm font-semibold transition",
      active ? "bg-black text-white" : "border border-black/10 bg-white/70 text-black/60"
    );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
      <div className="mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/70 bg-white/75 p-2 shadow-[0_16px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <Link href={menuHref} className={itemClassName(pathname.startsWith("/r/"))}>
          Меню
        </Link>
        <Link href="/cart" className={itemClassName(pathname === "/cart")}>
          Корзина
        </Link>
        <Link
          href={resolvedOrderHref}
          className={itemClassName(pathname === "/order" || pathname.startsWith("/order/") || pathname.startsWith("/pay/"))}
        >
          Заказ
        </Link>
        <InstallAppButton className={itemClassName(false)} />
      </div>
    </div>
  );
}
