-- Jalankan sekali di Supabase → SQL Editor → New query → Run.
--
-- Kenapa satu baris JSON per user, bukan tabel per elemen:
-- ini dipakai satu orang di beberapa perangkat, bukan banyak orang bersamaan.
-- Merge per elemen butuh tombstone (penanda "sudah dihapus") di seluruh model
-- data — kalau tidak, elemen yang dihapus di satu perangkat akan hidup lagi
-- saat sync dari perangkat lain. Itu kompleksitas besar untuk kasus yang
-- praktis tidak terjadi. Kolom `revision` di bawah sudah cukup menangkap kasus
-- berbahayanya (lihat lib/sync.ts).

create table if not exists public.workspaces (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb  not null,
  revision   bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- Tanpa ini, anon key bisa membaca workspace siapa pun. Jangan dihapus.
drop policy if exists "workspace milik sendiri" on public.workspaces;
create policy "workspace milik sendiri"
  on public.workspaces
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
