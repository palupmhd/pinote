"use client";

import { create } from "zustand";
import { snapshot, useCanvasStore, type Persisted } from "./store";
import { supabase } from "./supabase";

const SYNC_KEY = "milnote:sync:v1";
const PUSH_DEBOUNCE = 1500;

export type SyncStatus =
  | "disabled" // env Supabase belum diisi — murni lokal
  | "signed-out"
  | "synced"
  | "syncing"
  | "error"
  | "conflict";

/** revision = versi cloud yang jadi dasar salinan lokal kita.
 *  dirty   = ada perubahan lokal yang belum sampai ke cloud. */
interface SyncMeta {
  revision: number;
  dirty: boolean;
}

const readMeta = (): SyncMeta => {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) return JSON.parse(raw) as SyncMeta;
  } catch {
    /* abaikan */
  }
  return { revision: 0, dirty: false };
};

const writeMeta = (m: SyncMeta) => {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(m));
  } catch {
    /* abaikan */
  }
};

interface SyncState {
  status: SyncStatus;
  email: string | null;
  message: string | null;
  init: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  useCloudVersion: () => Promise<void>;
  useLocalVersion: () => Promise<void>;
}

/** Saat sedang menerapkan data dari cloud, jangan sampai perubahan store-nya
 *  dianggap sebagai edit lokal dan terkirim balik. */
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export const useSyncStore = create<SyncState>((set, get) => ({
  status: supabase ? "signed-out" : "disabled",
  email: null,
  message: null,

  init: async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      set({ status: "signed-out", email: null });
      return;
    }
    set({ email: user.email ?? null });
    await pull();

    supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        set({ email: session.user.email ?? null });
        void pull();
      } else {
        set({ status: "signed-out", email: null });
      }
    });
  },

  sendMagicLink: async (email) => {
    if (!supabase) return;
    set({ status: "syncing", message: null });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    set(
      error
        ? { status: "error", message: error.message }
        : { status: "signed-out", message: `Tautan masuk dikirim ke ${email}. Cek email.` }
    );
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ status: "signed-out", email: null, message: null });
  },

  // Ambil versi cloud, buang perubahan lokal yang bentrok.
  useCloudVersion: async () => {
    const remote = await fetchRemote();
    if (!remote) return;
    applyRemote(remote.data, remote.revision);
    set({ status: "synced", message: null });
  },

  // Pertahankan versi lokal, timpa cloud.
  useLocalVersion: async () => {
    const remote = await fetchRemote();
    if (!remote) return;
    writeMeta({ revision: remote.revision, dirty: true }); // samakan dasar, lalu dorong
    await push();
  },
}));

async function fetchRemote(): Promise<{ data: Persisted; revision: number } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("workspaces")
    .select("data, revision")
    .maybeSingle();
  if (error) {
    useSyncStore.setState({ status: "error", message: error.message });
    return null;
  }
  return data ? { data: data.data as Persisted, revision: Number(data.revision) } : null;
}

function applyRemote(data: Persisted, revision: number) {
  applyingRemote = true;
  useCanvasStore.getState().replaceWorkspace(data);
  writeMeta({ revision, dirty: false });
  applyingRemote = false;
}

async function pull() {
  if (!supabase) return;
  useSyncStore.setState({ status: "syncing" });
  const meta = readMeta();
  const remote = await fetchRemote();

  // Belum ada apa pun di cloud → kirim yang lokal sebagai isi pertama.
  if (!remote) {
    await push(true);
    return;
  }

  if (remote.revision === meta.revision) {
    // Cloud sama dengan dasar kita. Kirim kalau ada perubahan lokal.
    if (meta.dirty) await push();
    else useSyncStore.setState({ status: "synced", message: null });
    return;
  }

  if (!meta.dirty) {
    // Perangkat lain lebih baru dan kita tak punya perubahan → ambil saja.
    applyRemote(remote.data, remote.revision);
    useSyncStore.setState({ status: "synced", message: null });
    return;
  }

  // Dua-duanya berubah sejak sync terakhir. Jangan diam-diam membuang salah
  // satunya — biar orangnya yang memutuskan.
  useSyncStore.setState({
    status: "conflict",
    message: "Perangkat lain menyimpan perubahan, dan di sini juga ada yang belum tersimpan.",
  });
}

async function push(isFirst = false) {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  useSyncStore.setState({ status: "syncing" });
  const meta = readMeta();
  const payload = snapshot(useCanvasStore.getState());
  const revision = Date.now();

  if (isFirst || meta.revision === 0) {
    const { error } = await supabase
      .from("workspaces")
      .insert({ user_id: userId, data: payload, revision });
    if (error) {
      // Baris sudah ada (dibuat perangkat lain) → jangan timpa, tarik dulu.
      await pull();
      return;
    }
    writeMeta({ revision, dirty: false });
    useSyncStore.setState({ status: "synced", message: null });
    return;
  }

  // Kunci optimistik: hanya menimpa kalau cloud masih di revisi yang kita kira.
  // Ini yang mencegah tab basi menghapus kerja dari perangkat lain.
  const { data, error } = await supabase
    .from("workspaces")
    .update({ data: payload, revision, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("revision", meta.revision)
    .select("revision");

  if (error) {
    useSyncStore.setState({ status: "error", message: error.message });
    return;
  }
  if (!data || data.length === 0) {
    useSyncStore.setState({
      status: "conflict",
      message: "Perangkat lain menyimpan perubahan lebih dulu.",
    });
    return;
  }

  writeMeta({ revision, dirty: false });
  useSyncStore.setState({ status: "synced", message: null });
}

/** Tandai kotor + jadwalkan kiriman tiap kali kanvas berubah. */
export function startSyncWatcher() {
  if (!supabase) return () => {};
  return useCanvasStore.subscribe((state) => {
    if (!state.hydrated || applyingRemote) return;
    const status = useSyncStore.getState().status;
    if (status === "disabled" || status === "signed-out" || status === "conflict") return;

    writeMeta({ ...readMeta(), dirty: true });
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), PUSH_DEBOUNCE);
  });
}
