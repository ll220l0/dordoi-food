import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { ensureActiveRestaurant } from "@/lib/restaurant";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const restaurant = await ensureActiveRestaurant();

    if (restaurant) {
      redirect(`/r/${restaurant.slug}`);
    }
  } catch (error) {
    const isMissingTable =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
    if (!isMissingTable) {
      console.error("Home page DB lookup failed:", error);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl bg-white/70 backdrop-blur-xl shadow-card border border-black/5 p-6">
        <div className="text-xl font-bold">Dordoi Food</div>
        <div className="mt-2 text-sm text-black/60">
          App is running, but database is unavailable or no active restaurant is configured.
        </div>
      </div>
    </main>
  );
}
