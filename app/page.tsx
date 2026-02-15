import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" }
  });

  if (restaurant) {
    redirect(`/r/${restaurant.slug}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl bg-white/70 backdrop-blur-xl shadow-card border border-black/5 p-6">
        <div className="text-xl font-bold">Dordoi Food</div>
        <div className="mt-2 text-sm text-black/60">No active restaurant found. Please seed the database first.</div>
      </div>
    </main>
  );
}
