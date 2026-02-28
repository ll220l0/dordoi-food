import Link from "next/link";
import { cookies } from "next/headers";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/adminSession";

const ROLE_LABEL: Record<string, string> = {
  owner: "\u0412\u043b\u0430\u0434\u0435\u043b\u0435\u0446",
  operator: "\u041e\u043f\u0435\u0440\u0430\u0442\u043e\u0440",
  courier: "\u041a\u0443\u0440\u044c\u0435\u0440"
};

const ROLE_TONE: Record<string, string> = {
  owner: "border-amber-300/70 bg-amber-50 text-amber-700",
  operator: "border-cyan-300/70 bg-cyan-50 text-cyan-700",
  courier: "border-emerald-300/70 bg-emerald-50 text-emerald-700"
};

type NavItem = {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  accent: string;
  visible: boolean;
  featured?: boolean;
};

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function AdminHome() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? "";
  const session = token ? await verifyAdminSessionToken(token) : null;

  const role = session?.role ?? "";
  const roleLabel = ROLE_LABEL[role] ?? "\u0410\u0434\u043c\u0438\u043d";
  const roleTone = ROLE_TONE[role] ?? "border-slate-300/70 bg-slate-50 text-slate-700";

  const isOwner = session?.role === "owner";
  const isOperator = session?.role === "operator";
  const isCourier = session?.role === "courier";

  const navItems: NavItem[] = [
    {
      title: "\u0417\u0430\u043a\u0430\u0437\u044b",
      subtitle: "\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0438\u0020\u0438\u0441\u0442\u043e\u0440\u0438\u044f",
      href: "/admin/orders",
      icon: "\u25A6",
      accent: "from-slate-900 via-slate-800 to-black",
      visible: true,
      featured: true
    },
    {
      title: "\u041c\u0435\u043d\u044e",
      subtitle: "\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438 \u0438 \u0431\u043b\u044e\u0434\u0430",
      href: "/admin/menu",
      icon: "\u25A4",
      accent: "from-orange-500 via-amber-500 to-yellow-500",
      visible: isOwner || isOperator
    },
    {
      title: "\u0420\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b",
      subtitle: "Mbank \u0438 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u043e\u043f\u043b\u0430\u0442",
      href: "/admin/banks",
      icon: "\u25A8",
      accent: "from-violet-500 via-indigo-500 to-blue-500",
      visible: isOwner
    },
    {
      title: "\u041e\u0442\u0447\u0435\u0442\u044b",
      subtitle: "\u0412\u044b\u0440\u0443\u0447\u043a\u0430, \u043a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044f, \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430",
      href: "/admin/reports",
      icon: "\u25A9",
      accent: "from-cyan-500 via-sky-500 to-blue-500",
      visible: (isOwner || isOperator) && !isCourier
    },
    {
      title: "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438",
      subtitle: "\u0414\u043e\u0441\u0442\u0443\u043f\u044b \u0438 \u0440\u043e\u043b\u0438",
      href: "/admin/staff",
      icon: "\u25A3",
      accent: "from-emerald-500 via-teal-500 to-cyan-500",
      visible: isOwner || isOperator
    }
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-100 p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-200/80 to-transparent blur-3xl" />
        <div className="absolute -right-12 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-200/70 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-orange-200/60 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <section className="rounded-[28px] border border-white/80 bg-white/72 p-4 shadow-[0_26px_60px_-36px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[30px] font-black leading-none text-slate-900">{"\u0410\u0434\u043c\u0438\u043d\u043a\u0430"}</div>
              <div className="mt-2 text-sm text-slate-600">{"\u041f\u0430\u043d\u0435\u043b\u044c \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f"}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className={"inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold " + roleTone}>
                  {"\u0420\u043e\u043b\u044c:\u0020" + roleLabel}
                </div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                  {(session?.user ?? "admin") + " \u2022 online"}
                </div>
              </div>
            </div>

            <AdminLogoutButton className="px-3 py-2 text-sm" />
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{"\u0420\u0430\u0437\u0434\u0435\u043b\u044b"}</div>
              <div className="mt-1 text-lg font-black text-slate-900">{visibleItems.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{"\u0421\u0442\u0430\u0442\u0443\u0441"}</div>
              <div className="mt-1 text-lg font-black text-emerald-600">{"\u0410\u043a\u0442\u0438\u0432\u0435\u043d"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{"\u0414\u043e\u0441\u0442\u0443\u043f"}</div>
              <div className="mt-1 truncate text-lg font-black text-slate-900">{roleLabel}</div>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-3">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "group relative overflow-hidden rounded-3xl border px-4 py-4 transition-all duration-300 " +
                "hover:-translate-y-[2px] hover:shadow-[0_24px_46px_-30px_rgba(15,23,42,0.55)] active:translate-y-0 " +
                (item.featured
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-white/85 bg-white/80 text-slate-900 backdrop-blur-xl")
              }
            >
              <div className={"pointer-events-none absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity duration-300 group-hover:opacity-100 " + item.accent + (item.featured ? " opacity-90 group-hover:opacity-95" : "")}></div>
              <div className={"relative flex items-center gap-3 " + (item.featured ? "text-white" : "group-hover:text-white") }>
                <div className={
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-base font-black transition " +
                  (item.featured ? "bg-white/20 text-white" : "border border-slate-200 bg-white text-slate-700 group-hover:border-white/30 group-hover:bg-white/20 group-hover:text-white")
                }>
                  {item.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[22px] font-black leading-6">{item.title}</div>
                  <div className={"mt-1 text-sm " + (item.featured ? "text-white/80" : "text-slate-500 group-hover:text-white/85")}>{item.subtitle}</div>
                </div>

                <div className={"shrink-0 transition-transform duration-300 group-hover:translate-x-1 " + (item.featured ? "text-white" : "text-slate-500 group-hover:text-white")}>
                  <ChevronIcon />
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
