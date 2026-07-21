"use client";

import { create } from "zustand";

/** Notifikasi ringan sesaat ("toast") — konfirmasi aksi yang tadinya senyap
 *  (ekspor, salin/tempel, hapus, tautan masuk). State UI murni, tidak
 *  disimpan/di-sync. Opsional membawa satu aksi (mis. "Urungkan"). */
export interface Toast {
  id: string;
  message: string;
  /** Label tombol aksi (mis. "Urungkan"). Tanpa ini, toast hanya info. */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState {
  toasts: Toast[];
  /** Tampilkan toast; hilang otomatis setelah `ttl` ms (default lebih lama bila
   *  ada aksi supaya sempat diklik). Mengembalikan id-nya. */
  show: (t: Omit<Toast, "id"> & { ttl?: number }) => string;
  dismiss: (id: string) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: ({ ttl, ...t }) => {
    const id = crypto.randomUUID();
    const duration = ttl ?? (t.actionLabel ? 6000 : 3000);
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), duration)
    );
    return id;
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));

/** Helper non-React: dipanggil dari lib biasa (clipboard, dll.). */
export function toast(message: string, opts?: { actionLabel?: string; onAction?: () => void; ttl?: number }) {
  return useToastStore.getState().show({ message, ...opts });
}
