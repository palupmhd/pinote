"use client";

import { useEffect, useState } from "react";
import { startSyncWatcher, useSyncStore } from "@/lib/sync";

const LABEL: Record<string, string> = {
  syncing: "Menyinkronkan…",
  synced: "Tersinkron",
  offline: "Offline · antre sync",
  error: "Gagal sinkron",
  conflict: "Perlu keputusan",
};

export function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  const email = useSyncStore((s) => s.email);
  const message = useSyncStore((s) => s.message);
  const init = useSyncStore((s) => s.init);
  const sendMagicLink = useSyncStore((s) => s.sendMagicLink);
  const signOut = useSyncStore((s) => s.signOut);
  const acceptCloudVersion = useSyncStore((s) => s.acceptCloudVersion);
  const keepLocalVersion = useSyncStore((s) => s.keepLocalVersion);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    void init();
    return startSyncWatcher();
  }, [init]);

  // Env Supabase belum diisi → murni lokal. Dulu chip-nya hilang total; sekarang
  // tetap tampil supaya jelas datanya aman tersimpan (bukan hilang), hanya tak
  // ada sinkron. Tak ada panel login karena memang tak ada tujuannya.
  if (status === "disabled") {
    return (
      <span
        title="Sinkronisasi cloud tidak dikonfigurasi — semua tersimpan di perangkat ini"
        className="flex items-center gap-1.5 whitespace-nowrap px-2 py-1 text-xs text-neutral-500"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Lokal saja
      </span>
    );
  }

  const dot =
    status === "synced"
      ? "bg-emerald-400"
      : status === "syncing"
        ? "bg-amber-400"
        : status === "offline"
          ? "bg-slate-400"
          : status === "signed-out"
            ? "bg-neutral-300"
            : "bg-red-400";

  return (
    <div className="relative flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {status === "signed-out" ? "Masuk untuk sinkron" : (LABEL[status] ?? status)}
      </button>

      {status === "conflict" && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md bg-white p-3 text-xs shadow-lg ring-1 ring-red-200">
          <p className="font-medium text-neutral-800">Perubahan bentrok</p>
          <p className="mt-1 text-neutral-500">{message}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void acceptCloudVersion()}
              className="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"
            >
              Pakai versi perangkat lain
            </button>
            <button
              onClick={() => void keepLocalVersion()}
              className="rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"
            >
              Pakai versi di sini
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-md bg-white p-3 text-xs shadow-lg ring-1 ring-neutral-200">
          {email ? (
            <>
              <p className="text-neutral-500">Masuk sebagai</p>
              <p className="truncate font-medium text-neutral-800">{email}</p>
              <button
                onClick={() => void signOut()}
                className="mt-2 rounded bg-neutral-100 px-2 py-1 hover:bg-neutral-200"
              >
                Keluar
              </button>
            </>
          ) : (
            <>
              <p className="text-neutral-500">
                Masuk untuk membuka papan ini di perangkat lain. Tanpa masuk, semua tetap
                tersimpan di perangkat ini.
              </p>
              <form
                className="mt-2 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) void sendMagicLink(draft.trim());
                }}
              >
                <input
                  type="email"
                  required
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="email@kamu.com"
                  className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 outline-none focus:border-indigo-400"
                />
                <button className="rounded bg-indigo-500 px-2 py-1 text-white hover:bg-indigo-600">
                  Kirim
                </button>
              </form>
            </>
          )}
          {message && status !== "conflict" && (
            <p className="mt-2 text-neutral-500">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}
