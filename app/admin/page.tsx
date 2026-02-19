import Link from "next/link";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

export default function AdminHome() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold">Админка</div>
            <div className="mt-1 text-sm text-black/55">Панель управления.</div>
          </div>
          <AdminLogoutButton className="px-3 py-2 text-sm" />
        </div>

        <div className="mt-6 grid gap-3">
          <Link className="rounded-xl bg-black py-3 text-center font-semibold text-white" href="/admin/orders">
            Заказы
          </Link>
          <Link className="rounded-xl border border-black/10 bg-white py-3 text-center font-semibold" href="/admin/menu">
            Меню
          </Link>
        </div>
      </div>
    </main>
  );
}
