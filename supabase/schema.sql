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

-- Realtime: biar perubahan dari perangkat lain langsung muncul tanpa reload.
-- Langganan di lib/sync.ts memfilter per user_id; RLS di atas tetap berlaku
-- untuk realtime, jadi tiap orang cuma menerima barisnya sendiri.
-- Dibungkus supaya aman dijalankan ulang (add table error kalau sudah ada).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspaces'
  ) then
    alter publication supabase_realtime add table public.workspaces;
  end if;
end $$;

-- REPLICA IDENTITY FULL supaya payload menyertakan seluruh kolom (revision &
-- data) — tanpa ini kolom yang tak berubah bisa hilang dari event.
alter table public.workspaces replica identity full;
