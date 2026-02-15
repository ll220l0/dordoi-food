import Link from "next/link";

export default function AdminHome() {
  return (
    <main className="min-h-screen p-6">
      <div className="max-w-xl mx-auto">
        <div className="text-2xl font-extrabold">Admin</div>
        <div className="text-sm text-black/55 mt-1">Панель управления (защищена Basic Auth).</div>
        <div className="mt-6 grid gap-3">
          <Link className="rounded-xl bg-black text-white py-3 text-center font-semibold" href="/admin/orders">
            Заказы
          </Link>
          <Link className="rounded-xl bg-white border border-black/10 py-3 text-center font-semibold" href="/admin/menu">
            Меню
          </Link>
        </div>
      </div>
    </main>
  );
}
