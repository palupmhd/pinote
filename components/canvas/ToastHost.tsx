"use client";

import { useToastStore } from "@/lib/toast";

/** Menampilkan tumpukan toast di bawah-tengah kanvas. Ringan, tidak menghalangi
 *  interaksi (pointer-events hanya di kartu toast). */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-lg bg-neutral-900/95 px-3.5 py-2 text-sm text-white shadow-lg ring-1 ring-black/10 backdrop-blur"
        >
          <span>{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={() => {
                t.onAction?.();
                dismiss(t.id);
              }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-300 hover:bg-white/10 hover:text-blue-200"
            >
              {t.actionLabel}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            title="Tutup"
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
