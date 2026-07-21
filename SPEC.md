# Spesifikasi Teknis: Platform Visual Workspace (Milanote-like)

> **Baca file ini sebelum menambah fitur apa pun.** Ini bukan dokumen arsip —
> ini kesepakatan scope yang masih berlaku. Kalau kamu (manusia atau sesi
> Claude lain) mau menambah sesuatu yang tidak tercantum di sini, **tanya
> dulu ke pemilik project**, jangan langsung diputuskan sendiri berdasarkan
> "kelihatannya masuk akal". Riwayat perubahan dokumen ini ada di git log.

Disusun dari hasil riset knowledge base Milanote + inspeksi langsung struktur DOM/aset aplikasi Milanote, ditambah riset kompetitor dan diskusi keputusan scope untuk solo dev.

**Konteks pembuat:** solo dev, prioritas awal personal use (bukan tim), tapi tetap butuh akses multi-device. Rencana jangka panjang: bisa dikembangkan & dimonetisasi ke publik.

**Sumber kebutuhan asli (bukan cuma riset kompetitor):** pengalaman pribadi sebagai user Notion (sangat fleksibel tapi overwhelming — bikin satu task aja berasa males) yang pindah ke Milanote (lebih visual, lebih tenang) tapi kekurangan di sisi olah data terstruktur. Kebutuhan intinya: kanvas visual buat brainstorming/problem-solving/mindmap, dengan kemampuan "manggil" database seperti Notion di board manapun, dan relasi antar data yang bisa digambar sebagai panah — bukan cuma teks di properti.

---

## Status Implementasi (update tiap ada perubahan signifikan)

**Sudah dibangun & terverifikasi (v1):**
- Kanvas: pan/zoom imperatif (nol re-render React per frame — lihat catatan performa di bawah), drag kartu, multi-select, group move/delete, copy/paste/duplicate, undo/redo
- Elemen: Note (Tiptap), Image (paste/drop/file picker), Nested Board (BOARD_REF), Connector (generik, SVG layer), Task-list (dengan tenggat opsional per item), Link (dengan preview via `/api/link-preview`)
- Sync: Supabase (Postgres + Auth magic-link + Realtime subscription), autosave debounced, Last-Write-Wins dengan optimistic revision lock
- **Quick Capture / Inbox board** (spec §9.1) — board "Inbox" bawaan yang selalu ada & tak bisa dihapus (tak pernah muncul sebagai kartu; anak dari root supaya breadcrumb-nya "Home / Inbox"). Pintasan **Ctrl/Cmd+I dari mana saja** (termasuk saat mengetik di kartu lain — sengaja menimpa italic demi tangkap-tanpa-gesekan) membuka Inbox + catatan baru menumpuk rapi, langsung siap diketik. Tombol toolbar "📥 Inbox" untuk membuka/meninjau tanpa menambah catatan. Terverifikasi (buat/tumpuk/tinjau/persist/undo).
- **Export gambar PNG** (spec §6 gap #4a) — tombol "🖼 Ekspor PNG" mengekspor SELURUH papan yang dibuka (bukan cuma viewport): hitung kotak-batas semua kartu, render `#world-layer` via `html-to-image` dengan transform diganti sementara (origin ke pojok, skala 1 → pan/zoom tak memengaruhi hasil, tanpa kedipan layar), grid titik dikecualikan, pixelRatio 2. Papan kosong ditolak; gambar lintas-domain yang menodai canvas dilaporkan apa adanya. Terverifikasi (unduhan PNG berdimensi benar, isi kartu terlihat).

**v1 SELESAI.** Semua item v1 sudah dibangun & terverifikasi. Table sederhana non-relational sengaja dilewati (DatabaseView menutupinya).

**v1.1 (sedang berjalan, disetujui pemilik — dikerjakan satu per satu):**
- **Offline cache (IndexedDB)** — persistensi lokal pindah dari localStorage ke IndexedDB (kapasitas jauh lebih besar; data URL gambar sebelumnya bisa menembus batas ~5MB localStorage). Migrasi sekali dari localStorage lama lalu kuncinya dihapus. Terverifikasi (simpan/muat/reload/migrasi/offline).
- **Sync queue (online/offline-aware)** — `pull`/`push` menghormati `navigator.onLine`; saat offline statusnya "offline" dan perubahan tetap aman di IndexedDB (dirty), lalu di-flush otomatis oleh listener `online`. Indikator "Offline — tersimpan lokal" di chip sync. Catatan: ini offline **data**; shell aplikasi belum di-cache offline (butuh service worker/PWA — di luar item ini).
- **Presentation Mode (spec §9.2/§10.2)** — tombol "▶ Presentasi" menelusuri kartu papan mengikuti arah Connector sebagai jalur cerita (mulai dari kartu tanpa panah masuk, DFS panah keluar; sisa kartu disisipkan di akhir; tanpa konektor → urut baca). Saat presentasi: semua chrome disembunyikan, kamera memusatkan & mem-pas-kan tiap kartu dengan transisi halus, kanvas view-only. Navigasi ←/→/spasi & bilah kontrol; Esc keluar & memulihkan kamera semula. Terverifikasi (urutan: 6 kasus unit; mekanik UI: 12 cek).
- **Search lintas papan (spec §6 gap #6)** — palet (tombol "🔎 Cari" / Ctrl-Cmd+K) mencari catatan, tugas, tautan, sel+judul database, dan judul papan di SELURUH workspace; ↑/↓ pilih, Enter loncat (elemen → focusElement; papan → openBoard), Esc tutup. **Deviasi dari draft spec (Postgres FTS):** dibuat client-side atas workspace di memori — cocok dengan penyimpanan satu-blob-JSON + offline-first (instan, jalan tanpa koneksi); ganti ke FTS kalau kelak pindah ke penyimpanan per-elemen/multi-user. Terverifikasi (13 cek: lintas-papan, judul papan, kosong, Esc).
- **Minimap (spec §6 gap #5)** — peta kecil di pojok kiri-bawah menampilkan kotak semua kartu papan + kotak viewport yang **ikut pan/zoom secara live** (diposisikan imperatif dari `applyCamera`, konsisten dengan filosofi kamera imperatif). Klik/geser minimap → kamera pindah memusat ke titik itu. Sembunyi saat papan kosong & saat presentasi. Terverifikasi (6 cek: muncul/sembunyi, rect per kartu, viewport, klik-untuk-pan).
- Belum: Template starter.

**Sudah dibangun lebih awal dari jadwal (v1.1/v2, sebelum v1 tuntas):**
- Task due dates + Agenda view (harusnya v2, nyusul Calendar) — terverifikasi jalan
- **Database Block** (spec §7) sebagai `DatabaseView`: entitas `Database` terpisah dari Board (field `databases` di level workspace), dibuka lewat kartu pintu `DATABASE_REF`. **Beda dari desain awal:** row = `{id, cells}` (data terstruktur biasa), bukan reuse Nested Board — lebih murah, tapi kehilangan kemampuan "row dibuka jadi kanvas bebas" yang jadi alasan §7.3 aslinya. Kolom bertipe: text/number/checkbox/date/relation.
- **Relation-as-Connector** (spec §7.4): kolom tipe "relation" menautkan baris ke database lain; relasinya digambar sebagai panah di kanvas dengan reuse `ConnectorLayer` yang sama (gaya putus-putus ungu, diturunkan dari data — bukan disimpan sebagai elemen Connector terpisah). Sesuai desain.
- **Memanggil database yang sama di board lain** (kebutuhan asli §intro) — terverifikasi: `attachDatabase` menaruh kartu pintu baru ke database yang sudah ada, dan hapus satu kartu pintu tidak lagi menghapus entitasnya kalau masih ada kartu pintu lain yang menunjuk ke situ.

**Penyimpangan proses (bukan soal kualitas kode — kodenya diverifikasi baik):** sebagian besar daftar di atas (undo/redo sampai relations) dibangun dalam satu sesi otonom ~5,5 jam tanpa jeda untuk bertanya, sebelum dokumen ini dan aturan di CLAUDE.md ada. Hasilnya kebetulan solid dan konsisten dengan arsitektur yang direncanakan, tapi itu keberuntungan proses yang cacat, bukan bukti prosesnya boleh diulang. Lihat CLAUDE.md § "Aturan keras: jangan bangun lompat fase".

**v3:** belum disentuh — lihat §0 di bawah.

**Catatan performa (jangan diulangi):** kanvas sempat lag berat lalu nge-hang PC karena (1) Tiptap editor di-mount di semua note sekaligus meski tidak sedang diedit, (2) NoteCard re-render tiap frame pan/zoom karena tidak di-memo, (3) SVG connector sempat `width="0" height="0"` sehingga tidak pernah dilukis browser walau path-nya valid di DOM. Ketiganya sudah diperbaiki. Prinsip yang dipegang sekarang: **posisi kamera & drag diterapkan langsung ke DOM lewat ref, bukan lewat state React**, commit ke store hanya di akhir gesture. Commit `eb6ed4c` (relations) sempat kena varian baru dari kelas bug yang sama (selector zustand mengembalikan array baru tiap render → render loop) dan sudah diperbaiki di commit yang sama.

---

## 0. Ringkasan Keputusan Final

### Positioning produk (3 sumbu diferensiasi, dari §9.1)

1. **Calm/minimalis** — jangan coba out-feature Miro/Mural yang makin ramai. Ini alasan utama orang pilih Milanote.
2. **Structured ⇄ Spatial dual-mode** — database ala Notion, tapi bisa ditampilkan sebagai kartu bebas di kanvas juga. Belum ada kompetitor yang punya ini (§8.3).
3. **Frictionless + offline-capable** — tanpa paksa akun untuk guest (beda dari FigJam), dan tetap bisa dipakai walau internet buruk.

### Framework prioritas fitur: Paradigm-Prover vs Commodity

Dipakai untuk memutuskan apa yang masuk v1 vs ditunda:

| Kelas | Definisi | Sifat biaya | Contoh |
|---|---|---|---|
| **Paradigm-prover** | Cuma masuk akal karena ini kanvas spasial — nempel ke engine drag/pan/zoom/nest | Mahal, dan makin mahal kalau ditunda (coupling makin dalam) | Nested Board, Connector |
| **Commodity block** | Ada di semua app, berdiri sendiri, tidak nyentuh paradigma inti | Murah, dan **tetap murah kapan pun ditambah** | Task-list, Table, Link |

**Aturan:** kerjakan paradigm-prover selagi arsitektur masih cair (early). Commodity block boleh nyusul kapan saja — biayanya sama, ditambah minggu ke-2 atau minggu ke-8 tidak beda.

**Aturan kedua, sama pentingnya:** jangan tambah fitur karena "gampang" atau "kelihatannya berguna". Gate-nya adalah apakah memperkuat salah satu dari 3 sumbu diferensiasi di atas — bukan jumlah elemen, bukan kelengkapan fitur. Kalau ragu, jangan bangun dulu — tanya.

### Scope v1 (gate rilis)

**Elemen inti (harus terasa enak sebelum dianggap "jadi"):** Note (rich text), Image, Nested Board, Connector
**Elemen tempelan (murah, urutan bebas):** Link (dengan preview), Task-list, Table (grid sederhana, non-relational)
**Fitur non-elemen v1:**
- Quick Capture / Inbox board (board otomatis buat capture cepat tanpa mikir taksonomi — langsung nembak masalah "males bikin task karena harus milih tempat")
- Auth sederhana (single user, magic link)
- Autosave ke cloud (Supabase)
- Multi-device via Last-Write-Wins (bukan CRDT — karena satu user, bukan multi-editor bersamaan)
- Export board sebagai gambar (client-side, `html-to-image`)

**Sengaja BELUM masuk v1:** realtime collaboration multi-user, database/relations/formula, minimap, AI apa pun. (Realtime *sync* single-user — lihat catatan penyimpangan di atas — beda dari realtime *collaboration* multi-user; yang terakhir ini tetap belum dan tetap tidak direncanakan.)

### Scope v1.1

- Offline cache (IndexedDB) + sync queue
- Minimap
- Search dasar (Postgres full-text search)
- Template starter (board JSON siap pakai + fungsi duplicate board)
- **Presentation Mode** — jalur cerita mengikuti urutan Connector, toolbar disembunyikan (lihat §10.2)

### Scope v2

- **Database Block** (§8) — row = reuse Nested Board, mulai dari Table+Kanban view
- **Relation-as-Connector** (§8.6) — relasi antar row database digambar sebagai panah di kanvas
- Relations, Rollup, Formula preset, Calendar/Gallery view
- Backlinks / linked mentions (§10.3)

### Ditunda tanpa fase pasti (evaluasi ulang nanti, bukan direncanakan sekarang)

- **AI** (clustering, generate-dari-prompt) — gap nyata (§7 gap #7, §9 Whimsical/Miro), tapi sengaja tidak dijadwalkan supaya tidak jadi lubang scope-creep buat solo dev. Evaluasi ulang setelah v1 + v1.1 kepakai nyata.

---

## 1. Insight Arsitektur dari Milanote (Reverse-Engineering)

- **Tidak pakai `<canvas>`/WebGL.** Board dirender sebagai DOM tree biasa (`<div>`) dengan `transform: translate3d(...)` untuk posisi & pan/zoom.
- **Root structure:** satu "Board" adalah container rekursif. Board bisa berisi Board lain → nested folder tak terbatas, bukan hierarki terpisah (file vs folder disatukan jadi satu primitif: **Board**).
- **Toolbar elemen (primitif kanvas):** `card` (note/text), `link`, `task-list`, `line` (connector), `board` (nested), `column`, `comment-thread`, `table`, `image`.

**Kesimpulan:** Model data intinya sangat minimal — satu tipe **Board** (rekursif) berisi array **Element**. Kompleksitas produk ada di UX interaksi (drag/resize/connector smooth), bukan di variasi skema data.

## 2. Data Model

```
User
 └─ Board (rekursif — parentBoardId nullable)
     ├─ title, coverImage
     └─ Element[]
         ├─ id, type, x, y, width, height, zIndex, rotation
         ├─ type: NOTE | IMAGE | LINK | TASK_LIST | TABLE | CONNECTOR | BOARD_REF
         ├─ content (JSON, skema beda per type)
         └─ updatedAt   // dipakai untuk Last-Write-Wins conflict resolution

Element.CONNECTOR menyimpan sourceElementId & targetElementId — HARUS generik
(nunjuk ke Element ID apa pun, bukan di-hardcode ke tipe tertentu), supaya
nanti di v2 bisa dipakai juga buat Relation-as-Connector (§8.6) tanpa
mekanisme baru. (Sudah diimplementasi begini — lihat lib/types.ts.)

Element.BOARD_REF adalah "kartu" di kanvas yang membuka Board lain (nested
board) — representasi visual dari relasi parentBoardId yang sudah ada.
```

Implementasi aktual ada di `lib/types.ts` dan `lib/store.ts` — kalau ada perbedaan dengan dokumen ini, **kode adalah sumber kebenaran untuk detail teknis**, dokumen ini sumber kebenaran untuk **keputusan scope & urutan prioritas**.

## 3. Tech Stack

| Layer | Keputusan | Alasan |
|---|---|---|
| Frontend framework | **Next.js (App Router) + TypeScript** | Dipilih bukan cuma buat v1 — jadi rumah landing page publik saat monetisasi nanti |
| Rendering kanvas | **DOM + CSS transform**, posisi diterapkan imperatif via ref (bukan React state) saat gesture aktif | Lihat "Catatan performa" di atas — ini bukan opsional, ini pelajaran dari bug nyata |
| Rich text | **Tiptap** (StarterKit), hanya di-mount saat elemen sedang diedit | Editor per elemen yang diam itu mahal — sudah pernah bikin PC hang |
| Backend & data | **Supabase** (Postgres + Auth + Storage + Realtime) | |
| Sync multi-device | **Autosave debounced + Last-Write-Wins by revision**, plus Realtime subscription (lihat catatan penyimpangan) | |
| Link preview | **Next.js route handler** (`app/api/link-preview`), bukan Supabase Edge Function seperti draft awal | Next.js sudah ada, satu dependency eksternal lebih sedikit. Route ini fetch URL dari server — wajib ada guard SSRF (lihat kode) |
| Auth | **Supabase Auth** (magic link) | Single user, tidak perlu role/permission granular di v1 |
| Deployment | **Vercel** (Next.js) + **Supabase** (managed) | Belum di-deploy — masih jalan di dev server lokal |

**Sengaja tidak dipakai di v1:** Yjs/CRDT, Redis, backend terpisah, Meilisearch, Web Clipper browser extension, IndexedDB (ditunda ke v1.1).

## 4. Roadmap

**v1 — Kanvas Inti** (lihat Status Implementasi di atas untuk progress aktual)
**v1.1 — Polish & Ketahanan:** Offline cache, minimap, search, template starter, Presentation Mode
**v2 — Database & Struktur:** Database Block, Relation-as-Connector, Backlinks
**v3 — Monetisasi & Publik:** Landing page, pricing tier, evaluasi ulang kebutuhan kolaborasi multi-user

## 5. Referensi Model Bisnis (untuk v3)

- Free: 100 elemen, unlimited board
- Individual: ~$9.99–12.50/bln, unlimited elemen
- Team: ~$49/bln untuk 10 user

Gap diferensiasi: Milanote lemah di native integration/API publik dan data tabular berat.

## 6. Gap Milanote & Peluang Diferensiasi

| # | Gap Milanote | Solusi | Fase |
|---|---|---|---|
| 1 | Tidak ada mode offline | IndexedDB cache + sync queue (bukan Yjs — LWW cukup untuk single-user) | v1.1 |
| 2 | Tidak ada database relasional | Database Block — lihat §8 | v2 |
| 3 | Format teks terbatas | Tiptap dari awal | v1 (selesai) |
| 4 | Ekspor lemah | (a) Export gambar (b) Presentation Mode via urutan Connector | v1 (a), v1.1 (b) |
| 5 | Tidak ada minimap | SVG overlay dari posisi elemen | v1.1 |
| 6 | Aset tersebar | Search (v1.1) + Backlinks (v2) | v1.1 & v2 |
| 7 | Tanpa AI sama sekali | Sengaja tidak dijadwalkan | evaluasi ulang setelah v1.1 |

## 7. Desain Database Block (v2, belum dibangun)

Bukan clone penuh basis data relasional Notion — discope ke bagian yang paling nyambung dengan identitas kanvas spasial.

### 7.1 Fit Assessment

| Fitur Notion | Fit | Effort |
|---|---|---|
| Property-based page/row | Gratis dari arsitektur Board rekursif — row = nested Board | Rendah |
| Hierarchical block-in-row | Otomatis tercover | Gratis |
| Data-View Separation (Table/Kanban/Calendar/Gallery/List) | Value tinggi | Menengah |
| Relations | Tipe properti `RELATION` + sync 2 arah | Menengah-Tinggi |
| Rollups | Bergantung Relations, scope ke agregasi umum saja | Menengah |
| Formulas custom | **Jangan full-clone** — pakai preset function, bukan bahasa DSL | Tinggi kalau dipaksa full |

### 7.2 Diferensiator Inti: Dual-Mode View (Structured ⇄ Spatial)

Database Block bisa toggle antara **Structured View** (Table/Kanban/Calendar/Gallery, seperti Notion) dan **Spatial View** (tiap row jadi kartu bebas di kanvas, tetap punya properti terstruktur). Notion tidak punya mode spasial, Milanote tidak punya struktur — ini pembeda paling unik.

### 7.3 Perluasan Data Model

```
DatabaseBlock (entitas berdiri sendiri, TIDAK dimiliki satu Board — supaya
bisa "dipanggil" dari board mana pun)
 ├─ properties: Property[]
 └─ rows: BoardRef[]   // tiap row = Board rekursif

DatabaseView (Element baru, diletakkan di board mana pun)
 ├─ databaseBlockId   // nunjuk ke DatabaseBlock yang sama
 ├─ viewMode: TABLE | KANBAN | CALENDAR | GALLERY | LIST | SPATIAL
 └─ localFilters/sorts
```

### 7.4 Relation-as-Connector

Relasi antar row database digambar sebagai **garis visual di kanvas**, bukan cuma tag di properti — reuse `Element.CONNECTOR` yang sudah generik sejak v1. Tidak butuh mekanisme baru selama keputusan "Connector harus generik" dipegang konsisten.

## 8. Analisis Kompetitor (Miro, FigJam, Whimsical, Mural, Coda, Notion)

| Kompetitor | Insight |
|---|---|
| **Miro** | Jangan out-feature — pertahankan "calm" |
| **FigJam** | Guest wajib akun → peluang: share-link tanpa signup |
| **Whimsical** | AI generate-dari-prompt terbukti disukai user |
| **Mural** | Sering buggy, gagal aksesibilitas 508 → peluang: reliability & compliance |
| **Coda** | Formula power + realtime collab bisa jalan bareng tanpa lag |
| **Notion** | Sangat fleksibel tapi overwhelming — sumber masalah original produk ini |

## 9. Ide dari Pengalaman Pengguna Langsung

### 9.1 Quick Capture / Inbox Board (v1, belum dibangun)
Satu Board khusus buat capture cepat tanpa mikir taksonomi dulu — nembak langsung akar masalah "males bikin task di Notion".

### 9.2 Presentation Mode (v1.1)
Presentasikan langsung di app mengikuti urutan Connector sebagai jalur cerita — reuse data yang sudah ada, pengganti murah untuk export dokumen linear.

### 9.3 Backlinks / Linked Mentions (v2)
Gaya Obsidian — Note yang me-mention Board lain otomatis muncul sebagai referensi balik. Sepaket dengan Database Block (sama-sama cross-board reference).

### 9.4 AI — sengaja tidak direncanakan
Gap nyata tapi paling berisiko jadi scope-creep. Evaluasi ulang setelah v1 + v1.1 benar-benar terpakai.
