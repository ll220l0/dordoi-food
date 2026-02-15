export default function LoadingPayPage() {
  return (
    <main className="min-h-screen p-5 pb-36">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-black/60 border-t-transparent" />
          <div className="mt-4 text-center text-sm font-semibold text-black/70">Загружаем оплату...</div>
        </div>
      </div>
    </main>
  );
}
