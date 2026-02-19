"use client";

type DeliverySuccessOverlayProps = {
  visible: boolean;
  title?: string;
  subtitle?: string;
};

export function DeliverySuccessOverlay({
  visible,
  title = "Заказ доставлен",
  subtitle = "Статус заказа обновлен"
}: DeliverySuccessOverlayProps) {
  if (!visible) return null;

  return (
    <div className="delivered-overlay pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="delivered-card relative w-full max-w-sm overflow-hidden rounded-[28px] border border-emerald-200/80 bg-white/90 p-7 text-center shadow-[0_24px_70px_-24px_rgba(16,185,129,0.65)] backdrop-blur-xl">
        <div className="relative mx-auto h-24 w-24">
          <div className="delivered-check-ring absolute inset-0 rounded-full border-4 border-emerald-300/70" />
          <div className="delivered-check-core absolute inset-[14px] flex items-center justify-center rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 text-3xl font-black text-white shadow-[0_12px_30px_-12px_rgba(5,150,105,0.85)]">
            ✓
          </div>
        </div>
        <div className="mt-4 text-[24px] font-extrabold leading-tight text-emerald-700">{title}</div>
        <div className="mt-1 text-sm font-semibold text-emerald-700/75">{subtitle}</div>

        <span className="delivered-dot delivered-dot-1" />
        <span className="delivered-dot delivered-dot-2" />
        <span className="delivered-dot delivered-dot-3" />
        <span className="delivered-dot delivered-dot-4" />
        <span className="delivered-dot delivered-dot-5" />
        <span className="delivered-dot delivered-dot-6" />
      </div>
    </div>
  );
}

