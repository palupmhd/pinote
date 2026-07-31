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
- **Grid & snap-to-grid diperbaiki, batas kanvas kiri/atas (gaya Milanote):** warna dot grid diganti dari tan/beige (`#d8d4c8`, kurang bersih menurut pemilik) ke abu netral, lalu ke `rgba(0,0,0,0.15)` (dot pakai alpha bukan hex flat supaya "nyaru" ke kanvas apa pun — kontras rendah, tetap kelihatan). Jarak grid berubah beberapa kali ikut umpan balik visual pemilik: 16→24→20, final-nya **10px** (`GRID` di `lib/types.ts`) — dipilih bukan cuma dari selera tapi karena 10 membagi rata SEMUA lebar kartu bawaan (`lib/store.ts`: `NOTE_WIDTH` 240, `BOARD_CARD_WIDTH` 200, `TASK_LIST_WIDTH` 260, `LINK_WIDTH` 240, `DATABASE_CARD_WIDTH` 220). Efeknya: kartu attach ke dot bukan cuma di pojok kiri-atas, tapi tepi KANAN-nya pun jatuh pas di kolom dot yang sama. Dot sebelumnya tidak align dengan titik snap kartu — `radial-gradient` defaultnya center-of-tile, jadi dot visual ada di kelipatan `GRID+GRID/2`, sementara snap membulatkan ke kelipatan `GRID` bersih — diperbaiki dengan menggeser `background-position` setengah ubin (`applyCamera` di `Canvas.tsx`) supaya keduanya align. **Rentang zoom dipersempit ke 50%–200%** (dari 25%–200%, `MIN_ZOOM`/`MAX_ZOOM` di `lib/types.ts`). **Kiri/atas kanvas kini tepi keras** (x=0/y=0 tak pernah kelihatan di luar itu — `clampCamera` di `lib/geometry.ts`, dipakai baik di ref kamera live (`Canvas.tsx`) maupun `setCamera` store): pan tak bisa melewati tepi itu, kanan/bawah tetap tak terbatas. Kalau drag kartu (`moveMany`) mendorong kartu ke koordinat negatif, SEMUA kartu papan itu digeser bareng sejumlah overflow-nya (kamera TIDAK dikompensasi — pergeserannya harus kelihatan, itu yang bikin terasa "kanvas melebar"). **Dua arah** (bukan cuma extend): batas dihitung ULANG dari nol tiap commit drag (`minX`/`minY` atas SEMUA kartu papan, bukan dibandingkan ke batas lama) — begitu kartu yang tadinya di tepi ditarik menjauh (menyisakan celah), seluruh papan ikut "menyusut" balik supaya kartu paling kiri/atas yang SEKARANG selalu pas di 0. **Caveat yang perlu diketahui pemilik:** karena aturannya "kartu paling ekstrem SELALU di 0", papan dengan SATU kartu saja (atau kartu yang kebetulan selalu jadi kartu paling kiri/atas) akan selalu ditarik balik ke pojok (0,0) di akhir drag manapun — tak bisa "mengambang bebas" di tengah kanvas kosong selama dia tetap kartu paling ekstrem. Ini konsekuensi literal dari yang diminta (\"auto adjust sesuai object yang ada\"), belum tentu yang diinginkan untuk kasus kartu tunggal — beri tahu kalau ternyata mengganggu, gampang direlaksasi (mis. cuma menyusut kalau ada kartu LAIN yang jadi patokan baru, bukan tiap commit). **Bug ketemu & diperbaiki saat verifikasi:** `useElementDrag.ts` menulis posisi optimis ke DOM sebelum commit store; kalau `moveMany` menormalkan ulang ke nilai yang KEBETULAN sama dengan nilai yang React sudah pernah render (mis. balik lagi ke 0,0 setelah sebelumnya pernah di 0,0), React skip menulis ulang DOM (dibandingkan per-nilai, bukan per-referensi) — style yang ditulis manual sebelumnya nyangkut salah, tak pernah dikoreksi. Diperbaiki dengan membaca ulang posisi otoritatif dari store sesudah `moveMany` lalu paksa tulis ke DOM. Diverifikasi manual via Playwright (drag lintas-tepi → mendarat pas di batas; drag balik menjauh → batas ikut menyusut balik ke 0; zoom clamp 50%/200%; 0 console/page error). **Belum dikerjakan:** kartu baru lewat `addNote`/dbl-klik dekat tepi bisa saja langsung lahir sedikit negatif (belum lewat `moveMany`) — belum jadi masalah nyata, dicatat sebagai follow-up kalau kelak jadi isu.
- **Resize kartu (handle pojok kanan-bawah), dot grid dibuat nyaris tak kasat mata, chrome kartu dirapikan:** semua tipe kartu (Note/BoardRef/TaskList/Link/Image/DatabaseRef) sekarang punya `ResizeHandle` (`components/canvas/ResizeHandle.tsx`) — tarik untuk ubah lebar, sama seperti drag posisi: ditulis langsung ke DOM tiap frame (nol re-render), baru di-snap ke kelipatan `GRID` & di-commit ke store (`resizeElement` di `lib/store.ts`) saat pointer dilepas. Lantai lebar `MIN_CARD_WIDTH` (120px). Logika snap disatukan jadi `snapToGrid` di `lib/geometry.ts` (dipakai ulang oleh drag DAN resize, ganti fungsi lokal yang dulu cuma ada di `useElementDrag.ts`). ImageCard diubah dari height React-terhitung (`element.width * naturalHeight / naturalWidth`) ke CSS `aspect-ratio` murni — supaya saat resize menulis width langsung ke DOM, tinggi ikut menyesuaikan otomatis lewat CSS tanpa menunggu re-render (kalau tetap height-terhitung, gambar akan gepeng dulu selama drag baru "pop" benar saat commit). Header label tipe kartu (komponen `CardHeader`, mis. "CATATAN"/"TUGAS"/"TABEL" di atas tiap kartu) dihapus total — dianggap berisik/tak perlu; `CardHeader.tsx` dihapus, import ikon-per-tipe yang cuma dipakai di situ ikut dibersihkan (ikon di Toolbar tetap, itu importnya independen). Sudut kartu dikurangi dari `rounded-xl` ke `rounded-md` di keenam tipe kartu. Dot grid (lihat entri di atas) dibuat lebih transparan lagi (`rgba(0,0,0,0.09)`, radius 0.75px) atas permintaan pemilik supaya "seamless" — nyaris tak kelihatan dari jauh, cuma terasa kalau diperhatikan. Diverifikasi manual via Playwright (resize snap ke kelipatan 10, lebar akhir sesuai; hover kartu memunculkan handle connect+resize; 0 console/page error; tsc/eslint/33 unit test hijau).
- **Konektor: label, warna, gaya garis** (dipicu referensi flowchart swimlane pemilik) — `ConnectorElement` (`lib/types.ts`) dapat field opsional `label`/`color`/`style` (undefined = abu-abu solid tanpa label, konektor lama tetap valid tanpa migrasi). Palet warna preset tertutup (`CONNECTOR_COLORS`: gray/red/blue/green/purple/amber) — sengaja BUKAN color picker bebas, supaya konsisten dengan "calm/minimalis" (SPEC §0). Klik garis konektor (bukan dobel-klik, yang tetap = hapus) membuka `ConnectorPopover` — panel mini screen-space (bukan anak world-layer, supaya ukurannya tak ikut mengecil/membesar saat zoom) berisi input label, 6 swatch warna, toggle solid⇄putus-putus, tombol hapus. Popover tertutup lewat klik-luar atau Escape; klik-luar juga yang "menyelamatkan" popover dari basi kalau user mulai pan/drag (gestur itu selalu diawali pointerdown, jadi otomatis menutup duluan — tak perlu melacak ulang posisi tiap frame pan/zoom). Label digambar sebagai `<text>` SVG di titik tengah kurva (`connectorMidpoint` baru di `lib/geometry.ts`, reuse `edgePoint` yang di-export), posisinya ikut diperbarui di loop `redraw()` yang sama dengan path (jadi tetap ikut kartu saat digeser), dengan efek halo (`paintOrder:"stroke"`) supaya terbaca di atas grid apa pun. Arrowhead marker pakai `fill="context-stroke"` (SVG2) supaya otomatis ikut warna path pemakainya, bukan warna tetap seperti sebelumnya. **Belum dikerjakan (sengaja, sesuai rekomendasi ke pemilik):** routing siku/ortogonal ala swimlane — tetap kurva bezier `curveBetween`, karena butuh algoritma routing baru yang jauh lebih mahal untuk manfaat visual yang lebih kecil; ditunda sampai benar-benar dibutuhkan. Diverifikasi manual via Playwright (gambar konektor, klik buka popover, isi label, ganti warna+gaya, klik-luar menutup & konektor persist dengan label/warna/gaya yang benar; 0 console/page error; tsc/eslint/33 unit test hijau).
- **Batas kanvas digeser ke dot ke-7, resize dua sumbu, hit-area konektor diperlebar** — `CANVAS_MARGIN = 7×GRID` (`lib/types.ts`) menggeser batas kiri/atas yang tadinya persis di dot ke-0 (world 0,0) ke dot ke-7 (world 70,70), atas permintaan pemilik supaya ada sedikit buffer dari tepi sungguhan. `clampCamera` (pan) dan normalisasi `moveMany` (dua arah, extend/shrink) sama-sama pakai konstanta ini, jadi keduanya selalu sepakat di mana batasnya — diverifikasi drag kartu lintas-tepi mendarat pas di `left/top: 70px`. **Resize sekarang dua sumbu** (lebar DAN tinggi, bukan cuma lebar): `BaseElement` dapat field opsional `height` (undefined = tinggi alami: ikut konten atau aspect-ratio gambar), `resizeElement` di store terima patch `{width?, height?}`, dan `ResizeHandle` menulis kedua sumbu langsung ke DOM lalu snap keduanya ke `GRID` saat dilepas (`MIN_CARD_HEIGHT` 60px sebagai lantai). Tinggi diterapkan ke wrapper KONTEN (`contentRef`, `overflow-y:auto`) bukan ke kotak ROOT kartu — supaya ConnectHandle/ResizeHandle/CardActionBar yang posisinya absolute sedikit di luar root tak ikut kepotong; ImageCard jadi pengecualian (tinggi ke root langsung, root-nya sendiri sudah `overflow-hidden` buat crop gambar via `object-fit:cover` begitu tinggi pernah di-resize, ganti dari aspect-ratio otomatis). Semua lebar kartu bawaan dicek ulang — sudah kelipatan 10 dari sebelumnya (240/200/260/240/220/320/140), tak perlu perubahan. **Hit-area konektor & connect-handle diperlebar** (keluhan pemilik: "arrow sulit diklik") — tiap garis konektor sekarang punya path tak-kasat-mata tebal 20px yang menampung klik/dobel-klik/hover (garis visual 2px di atasnya jadi `pointer-events-none`, cuma dekoratif, bereaksi lewat `group-hover`), path lebar itu ikut di-redraw bareng path visual di loop yang sama supaya tetap menempel saat kartu digeser. `ConnectHandle` (dot buat mulai menarik panah) area kliknya diperbesar dari 16px ke 28px (dot yang kelihatan tetap 16px, cuma bungkusnya lebih besar) — dites klik 8px meleset dari garis persis, popover tetap kebuka. Diverifikasi manual via Playwright (batas di 70px, resize dua sumbu jadi kelipatan 10, klik meleset dari garis konektor tetap membuka popover; 0 console/page error; tsc/eslint/33 unit test hijau).
- **Bug nyata ditemukan & diperbaiki: drag kartu MANAPUN selalu "ketarik" ke batas** (dilaporkan pemilik) — `moveMany` versi sebelumnya menghitung ulang `minX`/`minY` SELURUH papan tiap commit lalu SELALU memaksa nilainya persis `CANVAS_MARGIN`, tanpa peduli kartu mana yang digeser. Efeknya: papan mana pun yang kartu-paling-kiri-atasnya belum kebetulan pas di margin (kasus umum — kartu baru dari `addNote` dsb lahir di posisi bebas) akan menggeser SELURUH papan ke batas begitu kartu APA SAJA digeser, walau kartu itu jauh dari tepi & tak ada urusan dengan batasnya. Diperbaiki dengan membedakan dua kondisi secara eksplisit: **extend** (kartu terdorong ke bawah margin) tetap dipaksa selalu, kartu mana pun; **shrink** (menyusut balik) HANYA jalan kalau kartu yang SEBELUM geseran ini menempel pas di margin itu SENDIRI yang termasuk yang digeser — dicek dengan membandingkan posisi SEBELUM update diterapkan (`oldMinX`/`oldMinY`) terhadap kartu yang ada di array `updates`. Diverifikasi regresi: dua kartu jauh dari tepi, drag salah satunya sedikit → kartu yang TIDAK digeser kini tetap diam (dulu ikut ter-yank); round-trip extend→shrink tetap jalan seperti sebelumnya.
- **Tinggi kartu otomatis dibulatkan ke kelipatan grid, biar jarak antar-kartu konsisten** (dilaporkan pemilik: tinggi tak pas di dot, jarak antar kartu beda-beda) — posisi (x/y) kartu sudah kelipatan grid lewat snap drag, tapi TINGGI alami (ikut konten: jumlah baris teks, item tugas, dst) sebelumnya bebas berapa saja, jadi jarak visual ke kartu di bawahnya beda-beda tergantung isi tiap kartu. Hook baru `useSnapAutoHeight` (`lib/useSnapAutoHeight.ts`, dipasang di NoteCard/TaskListCard/BoardCard/DatabaseCard/LinkCard — ImageCard dilewati, sudah punya batas sendiri dari aspect-ratio/crop) mengamati wrapper konten lewat `ResizeObserver` dan membulatkan tingginya ke ATAS ke kelipatan `GRID` lewat `padding-bottom` tambahan — tak pernah mengurangi/memotong konten, cuma menambah ruang kosong di bawah secukupnya. Padding dasar (dari class Tailwind tiap kartu, mis. `pb-3`) diukur sekali lewat `getComputedStyle` sebelum disentuh, jadi hook-nya tak perlu tahu angka padding tiap pemanggil; padding tambahan yang ditulis sendiri dikurangi lagi sebelum menghitung tinggi "alami" berikutnya, supaya `ResizeObserver` stabil (tak memicu dirinya sendiri berulang). Otomatis nonaktif (padding dibersihkan) begitu kartu punya `height` eksplisit dari resize manual (yang sudah kelipatan grid dari `ResizeHandle`, tak perlu dibulatkan lagi). Diverifikasi manual via Playwright (Note 1 baris & Note multi-baris keduanya dites — tinggi akhir keduanya kelipatan 10 persis; 0 console/page error; tsc/eslint/33 unit test hijau).
- **Bug: klik tunggal Note bisa masuk mode edit teks** (dilaporkan pemilik: harusnya cuma dobel-klik) — penyebabnya bukan di logic seleksi/drag (itu sudah benar, cuma memanggil `select()`), tapi tombol "✎ Edit catatan" di `CardActionBar` yang muncul begitu Note terpilih (satu klik) dan langsung memicu `setEditing` pada SATU klik tombol itu — niatnya dulu buat aksesibilitas layar sentuh, tapi bertentangan dengan aturan "klik tunggal cuma pilih, dobel-klik baru edit". Tombol itu dihapus untuk NOTE (satu-satunya tipe yang punya aksi "mulai edit teks" di situ); tombol "↗" tipe lain (BOARD_REF/DATABASE_REF/LINK) dibiarkan — itu navigasi eksplisit, bukan mulai mengedit teks, jadi klik tunggal tetap wajar. Diverifikasi via Playwright (klik di posisi tombol lama tak lagi memunculkan editor; dobel-klik tetap masuk mode edit seperti biasa).
- **Model panah konektor disempurnakan** (keluhan pemilik: kepala panah "aneh") — dua iterasi. **Percobaan pertama** (sumbu-dominan: lengkung ikut horizontal ATAU vertikal tergantung `|dx|` vs `|dy|`) ternyata BUKAN perbaikan — begitu kedua kartu punya selisih horizontal DAN vertikal yang sama-sama berarti (bukan murni satu sumbu), titik kontrolnya dipaksa berbagi koordinat X/Y persis dengan titik ujung, jadi kurvanya harus berbelok tajam di tengah buat mengejar selisih itu → muncul sebagai kaitan/hook yang janggal (dilaporkan ulang oleh pemilik dari tangkapan layar nyata). **Perbaikan final:** `connectorPath` (`lib/geometry.ts`) menarik tiap titik kontrol bezier SEPANJANG arah keluar alami kotaknya sendiri (vektor pusat-kotak→titik-tepi dari `edgePoint`, diperpanjang keluar sejauh `pull`) — bukan dipaksa ke satu sumbu tetap. Ini menghindari belokan tajam untuk sudut berapa pun antara dua kartu (diverifikasi: diagonal, horizontal murni, dan vertikal murni semua melengkung mulus tanpa kaitan). `curveBetween` (titik-ke-titik polos, dipakai garis bayangan/ghost saat menarik konektor baru — targetnya cuma kursor mentah tanpa kotak) dikembalikan ke bentuk horizontal-dulu semula. Bentuk kepala panah (dart bertakik, ukuran dinaikkan) juga DIKEMBALIKAN ke segitiga rata ukuran semula — pemilik eksplisit bilang versi lama lebih bagus.
- **Warna dasar kanvas diganti dari off-white hangat ke netral dingin** — sebelumnya `#F7F6F2` ("ala Milanote — bukan putih dingin", per komentar lama di `globals.css`), sekarang `#F6F6F7` (lebih ke arah Linear/Notion). Keputusan pemilik lewat perbandingan visual langsung (artifact 4 opsi: A-baseline hangat, B-baseline hangat+border diselaraskan, C-kertas krem lebih pekat, D-netral dingin) — pemilik pilih **D**. Border kartu (`ring-neutral-200`) TIDAK diubah — kebetulan sudah cocok temperaturnya dengan kanvas netral yang baru (beda dari opsi B yang perlu menyelaraskan border ke arah hangat; opsi D justru sebaliknya, kanvas yang digeser ke temperatur border). `--foreground` (warna teks dasar) ikut digeser dari hitam hangat (`#1F1E1C`) ke hitam netral (`#18181B`) biar satu keluarga temperatur. Warna halo label konektor (`ConnectorLayer.tsx`, dipakai supaya teks label terbaca di atas grid apa pun) disesuaikan ikut warna kanvas baru. Tiga titik sumber diubah: `components/canvas/Canvas.tsx` (bg kanvas), `app/globals.css` (`--background`/`--foreground`), `components/canvas/ConnectorLayer.tsx` (halo label). Diverifikasi visual via Playwright — 0 console/page error, tsc/eslint/33 unit test hijau.
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
- **Template starter (spec v1.1)** — menu "↳ dari template…" di bawah "+ Papan" membuat papan baru berisi kartu tertata dari template siap-pakai (Brainstorm, Papan tugas/kanban, Catatan rapat, Rencana mingguan — Note & Task-list saja supaya mandiri), lalu langsung membukanya. Satu langkah undo. (Duplicate board sudah ada sejak v1 lewat copy/paste/duplicate kartu papan.) Terverifikasi (10 cek: buat/buka/isi/persist/undo).

**v1.1 SELESAI.** Semua item v1.1 sudah dibangun & terverifikasi (Offline cache, Presentation Mode, Search, Minimap, Template starter). Beberapa deviasi terdokumentasi (search client-side; offline data-only tanpa service worker).

**v2 (sedang berjalan, disetujui pemilik — satu per satu):**
- **Database: tampilan Kanban** (§7.3 view mode) — pengalih Tabel ⇄ Kanban di header DatabaseView. Kanban mengelompokkan baris berdasarkan kolom teks/centang (default: kolom centang pertama), tiap grup jadi kolom kartu; pindah baris antar-grup lewat pemilih di kartu; "+ baris" per grup mengisi sel pengelompok otomatis; pemilih "Kelompokkan:" untuk ganti kolom. Mode & groupBy tersimpan di entitas Database (persist/sync). Terverifikasi (10 cek). *Catatan: interaksi pindah pakai dropdown, belum drag-and-drop — polish menyusul.*
- **Database: tampilan Kalender** (§7.3 view mode) — pengalih Tabel⇄Kanban⇄Kalender. Kalender menempatkan baris pada grid bulan berdasarkan kolom Tanggal (default: kolom date pertama; pemilih "Berdasarkan:" bila ada beberapa). Navigasi bulan ‹ › + "Hari ini", hari ini disorot, "+" per hari menambah baris bertanggal itu, overflow "+N lagi". Kolom date tersimpan di entitas (`dateBy`, persist/sync). Bulan tampil = state lokal (selalu buka di bulan ini). Terverifikasi (9 cek).
- **Database: tampilan Galeri** (§7.3 view mode) — pengalih Tabel⇄Kanban⇄Kalender⇄Galeri. Galeri menampilkan tiap baris sebagai kartu di grid responsif: judul (kolom teks pertama, bisa diedit) + ringkasan kolom lain (baca saja), "+ Tambah baris" & hapus per kartu. Terverifikasi (7 cek). Database kini punya 4 tampilan.
- **Rollup columns** (spec §7.1) — tipe kolom "rollup" mengagregasi lewat kolom relasi: `count` (jumlah baris tertaut) atau `sum/avg/min/max` atas kolom angka di database tujuan. Dikonfigurasi di header kolom (pilih relasi, fungsi, kolom angka); nilainya dihitung (tak disimpan), baca saja, dan ikut berubah saat tautan berubah. Terverifikasi (compute 10 unit + wiring 5 cek).
- **Kanban drag-and-drop** — seret kartu antar kolom untuk memindah grup (pointer-based via `elementFromPoint`, konsisten dg kanvas; kolom tujuan disorot saat di-drag). Pemilih dropdown tetap ada sebagai alternatif aksesibel. Terverifikasi (drag dua arah, dropdown tak regresi).
- **Kalender drag-and-drop** — seret baris antar sel hari untuk memindah tanggalnya (pointer-based via `elementFromPoint` + `data-day-key`, pola sama dg Kanban; hari tujuan disorot saat di-drag). `draggedRef` membedakan geser-antar-hari dari tap: tap tetap membuka drawer hari, Enter/klik tetap jalan (a11y). Terverifikasi (smoke Playwright 5 cek: tampil/pindah/tak-tertinggal/tap-buka-drawer).
- **Dual-mode Structured⇄Spatial — irisan tipis "Buka baris sebagai kanvas"** (§7.2, keputusan pemilik: opsi aditif). Alih-alih mengubah row jadi Nested Board (yang membongkar 5 view + relations + rollups yang sudah jalan), row tetap `{id, cells}` dan **ditambah** field opsional `boardId?`. Tombol ⤢ per-baris (Tabel & Galeri) membuat Board bersarang secara lazy saat pertama dibuka lalu langsung membukanya (judul board = sel teks pertama baris; parent = board tempat kartu database berada, jadi breadcrumb punya jalan pulang — pola sama dg Inbox). `cells` tetap gudang properti; semua view existing tak tersentuh. Cleanup: hapus baris / buang entitas database ikut membuang board bertaut + keturunannya (tak menggantung); duplikasi kartu database melepas `boardId` klon supaya asli & salinan tak berbagi board. Terverifikasi (smoke Playwright 8 cek: buka/judul/persist reload/indikator/hapus).
- **Database: tampilan Spatial** (§7.2 dual-mode penuh, mode ke-5) — pengalih Tabel⇄Kanban⇄Kalender⇄Galeri⇄Spasial. Tiap baris jadi kartu bebas yang bisa digeser di permukaan yang bisa di-scroll (self-contained di overlay, bukan kanvas imperatif utama), tetap membawa properti terstrukturnya (judul bisa diedit + ringkasan kolom lain + ⤢ buka-sebagai-kanvas + hapus). Posisi tersimpan di baris (`sx/sy`, aditif → nol migrasi); baris tanpa koordinat di-auto-layout grid, dapat koordinat sendiri saat pertama digeser (commit saat drop). **Panah relasi (§7.4):** kolom relasi yang menunjuk database yang SAMA (self-referencing) digambar sebagai panah antar-kartu (ungu putus-putus, reuse `connectorPath`) yang ikut bergerak saat kartu digeser — mind-map antar-baris; relasi ke database lain tetap tampil sebagai chip. Untuk memungkinkannya, picker target relasi kini menyertakan opsi "(ini sendiri)" (panah kanvas utama sudah mengabaikan self-loop kartu yang sama). Terverifikasi (smoke Playwright 8 cek: kartu tampil/panah/geser/persist view+posisi+panah setelah reload). Database kini punya 5 tampilan.
- **Formula preset** (spec §7.1: preset, bukan DSL) — tipe kolom "formula" yang dihitung & baca-saja (seperti rollup, tak menyimpan sel). 7 preset: `days_until`/`date_status` (input 1 kolom Tanggal), `sum`/`diff`/`product`/`percent` (input 2 kolom Angka), `concat` (input 2 kolom apa saja). Dikonfigurasi di header (pilih preset → picker kolom input yang tersaring sesuai preset); nilainya ikut berubah saat sel sumber berubah. Terverifikasi (smoke Playwright 7 cek: days_until/sum/concat, reaktivitas, persist reload).
- **Backlinks / Linked Mentions** (spec §9.3/§10.3, gaya Obsidian) — ketik `@` di Note → popup pemilih papan (inline autocomplete via `@tiptap/extension-mention` + `@tiptap/suggestion`; popup DOM sendiri, tanpa tippy) → sisip node mention. Mention dirender sebagai `<a href="board:<id>">@Judul</a>`: (1) lolos sanitizer HTML apa adanya (skema `board:` aman, tak perlu ubah allowlist), (2) diklik di render statis untuk navigasi (`openBoard`), (3) jadi sumber turunan backlink. Panel **"↩ N referensi"** di breadcrumb papan yang sedang dibuka: `backlinksTo()` memindai semua Note yang me-mention papan itu, klik entri → `focusElement` lompat ke catatannya. Diturunkan dari data, tak disimpan. Terverifikasi (smoke Playwright 9 cek: popup/sisip/navigasi/panel/kembali/persist).

**v2 SELESAI.** Semua item v2 sudah dibangun & terverifikasi (Database Block + 5 tampilan termasuk Spatial, Relation-as-Connector, Rollup, Formula preset 7, Backlinks). Deviasi terdokumentasi: row = `{id,cells}` + dual-mode via irisan "buka baris sebagai kanvas" (bukan row-as-Board penuh); backlink & mention berbasis tautan `board:` (bukan node data terpisah).

**Sudah dibangun lebih awal dari jadwal (v1.1/v2, sebelum v1 tuntas):**
- Task due dates + Agenda view (harusnya v2, nyusul Calendar) — terverifikasi jalan
- **Database Block** (spec §7) sebagai `DatabaseView`: entitas `Database` terpisah dari Board (field `databases` di level workspace), dibuka lewat kartu pintu `DATABASE_REF`. **Beda dari desain awal:** row = `{id, cells}` (data terstruktur biasa), bukan reuse Nested Board — lebih murah, tapi kehilangan kemampuan "row dibuka jadi kanvas bebas" yang jadi alasan §7.3 aslinya. Kolom bertipe: text/number/checkbox/date/relation.
- **Relation-as-Connector** (spec §7.4): kolom tipe "relation" menautkan baris ke database lain; relasinya digambar sebagai panah di kanvas dengan reuse `ConnectorLayer` yang sama (gaya putus-putus hijau forest, diturunkan dari data — bukan disimpan sebagai elemen Connector terpisah). Sesuai desain.
- **Memanggil database yang sama di board lain** (kebutuhan asli §intro) — terverifikasi: `attachDatabase` menaruh kartu pintu baru ke database yang sudah ada, dan hapus satu kartu pintu tidak lagi menghapus entitasnya kalau masih ada kartu pintu lain yang menunjuk ke situ.

**Penyimpangan proses (bukan soal kualitas kode — kodenya diverifikasi baik):** sebagian besar daftar di atas (undo/redo sampai relations) dibangun dalam satu sesi otonom ~5,5 jam tanpa jeda untuk bertanya, sebelum dokumen ini dan aturan di CLAUDE.md ada. Hasilnya kebetulan solid dan konsisten dengan arsitektur yang direncanakan, tapi itu keberuntungan proses yang cacat, bukan bukti prosesnya boleh diulang. Lihat CLAUDE.md § "Aturan keras: jangan bangun lompat fase".

**v3:** belum disentuh — lihat §0 di bawah.

**Tes otomatis (mulai ada sejak audit):** `npm test` — runner + type-stripping bawaan Node, **tanpa dependency baru**. Mencakup modul murni & kode keamanan: `sanitizeHtml` (skema href), `urlGuard` (penjaga SSRF), `formula` (7 preset), `rollup` (5 operasi), `presentation` (urutan konektor). Sebelum ini proyek NOL tes: tiap fitur diverifikasi sekali pakai skrip Playwright sementara yang hilang bersama kontainer — itulah sebabnya regresi seperti batas zoom 400% dan `sharpenAtRest` yang tak berefek bisa lolos berkali-kali. **Kalau menyentuh modul di atas, jalankan `npm test`.** Tes baru diletakkan sebagai `lib/<modul>.test.ts`.

**Catatan keamanan (jangan diulangi):** dua lubang lolos berbulan-bulan karena penjaganya ditulis sebagai *denylist* dan tak pernah diuji. (1) `sanitizeHtml` menolak `javascript:` lewat `startsWith` — dilewati dengan menyisipkan tab/LF/CR di tengah skema, karena browser mengabaikan karakter itu saat membaca skema. (2) Penjaga SSRF membandingkan `hostname === "::1"`, padahal `URL.hostname` mengembalikan IPv6 **berkurung siku**, jadi seluruh ruang IPv6 (termasuk loopback ter-map `[::ffff:127.0.0.1]`) lolos. Prinsip yang dipegang sekarang: **allowlist, bukan denylist**, dan tiap penjaga keamanan wajib punya tes yang terbukti gagal pada versi rentannya.

**Status audit (per gelombang, bukan sapuan merata):** Sesi audit ini menyisir 34 area berdasar risiko — keamanan → integritas data/sync → aksesibilitas → responsif mobile → performa — bukan seluruh permukaan fitur secara setara. 5 bug ditemukan & diperbaiki (2 keamanan di atas; konflik sync palsu dari perubahan non-dokumen seperti seleksi/pan; baca cloud tanpa filter `user_id`; fokus keyboard hilang total di 24 field karena `outline-none` tanpa pengganti; kontrol TopBar/Toolbar terpotong di layar <640px). Performa diuji langsung (PerformanceObserver, 0 long-task di 120 kartu selagi pan/zoom/drag) — sehat, tak ada temuan.

**Gelombang 6 — Connector + kaskade hapus:** ditemukan 1 bug data-integrity: `removeRow` (baris database yang punya kanvas bertaut via "buka baris sebagai kanvas") punya kaskade hapus board yang **dangkal** — beda dari kaskade kartu BOARD_REF/DATABASE_REF yang sudah benar (`removeElements`/`purge`) — jadi kalau board bertaut itu berisi kartu Database (DATABASE_REF), database di dalamnya **tidak ikut terhapus**: jadi "database hantu" yang nyangkut selamanya di store, tak tersambung ke kartu mana pun, tapi tetap muncul di DatabasePicker ("↳ pakai yang ada…"). Diperbaiki dengan menyatukan logikanya ke satu fungsi `purgeBoardCascade` (dipakai bareng oleh `removeElements` dan `removeRow`) supaya kaskade board→elemen→database yatim konsisten di semua jalur hapus. Regresi terekam di `lib/store.test.ts` (dikonfirmasi gagal di kode lama, lolos di kode baru). Konektor sendiri: cleanup ghost-line saat pointer-cancel & orphan-pruning saat elemen dihapus sudah diverifikasi benar (satu-satunya sumber kaskade, dipakai konsisten). **Belum diaudit**: kaskade hapus kolom relation/panah spesifik (hapus kolom relation vs hapus database target), cleanup lanjutan setelah database dilepas dari semua board tapi row-nya masih ada boardId basi (edge case ganda-hapus).

**Gelombang 7 — Export PNG:** ditemukan 1 bug UI serius: tombol "Lainnya" (⋯) di Toolbar — satu-satunya jalan ke Presentasi, Ekspor PNG, Template picker, dan "↳ pakai database yang ada" — **tak bisa diklik sama sekali**, di semua ukuran layar. Penyebab: fix responsif mobile gelombang sebelumnya menambah `overflow-x-auto` pada kontainer Toolbar; kuirk spec CSS (satu sumbu overflow non-`visible` memaksa sumbu lain jadi `auto`, bukan `visible`, meski tak diminta) membuat popup menu `absolute bottom-full` yang harusnya melayang di atas toolbar malah terpotong — secara visual tampak ada, tapi `elementFromPoint`/klik asli jatuh ke kanvas di baliknya. Diverifikasi lewat klik Playwright sungguhan (bukan cuma DOM query) sebelum & sesudah fix. Diperbaiki dengan me-portal panel menu ke `document.body` (posisi `fixed` dihitung dari rect tombol, bereaksi ke resize/scroll) sehingga lolos dari clipping ancestor manapun — pola sama yang dipakai Radix/Headless UI untuk masalah ini. Setelah fix: ekspor papan kosong menampilkan alasan gagal yang jelas, ekspor papan berisi kartu menghasilkan file PNG valid, Presentasi & pickers tetap berfungsi lewat portal, klik-luar tetap menutup menu. Tak ada test otomatis ditambahkan (bug UI interaksi DOM, bukan modul murni) — diverifikasi manual via Playwright sekali jalan.

**Gelombang 8 — detail editing Note/Task-list:** 17 cek Playwright: Note (dobel-klik masuk edit/single-klik cuma select, konten persist setelah klik-luar, konten termuat benar saat dobel-klik ulang, `@mention` autocomplete sisip node yang benar & lolos jadi link `board:` di render statis, klik mention bener-benar navigasi papan lewat `openBoard`), Task-list (dobel-klik masuk edit fokus ke field yang di-klik, Enter menambah item & pindah fokus, Backspace di item kosong menghapus & pindah fokus mundur, item terakhir tak bisa dihapus, Escape & klik-luar keluar mode edit, checkbox & due-date tetap bisa dioperasikan TANPA masuk mode edit). **0 bug ditemukan** — dua kegagalan awal di skrip audit ternyata bug skrip sendiri (selector `text=Home` bentrok dengan breadcrumb TopBar yang juga bertuliskan "Home", dan generic `input` locator ikut menangkap checkbox yang selalu ada di luar mode edit), dikonfirmasi lewat debug terpisah sebelum disimpulkan aman.

**Gelombang 9 — offline queue (autosave IndexedDB):** ditemukan 1 bug nyata (bukan cuma teoretis, direproduksi langsung): watcher autosave di `store.ts` men-subscribe ke SEMUA perubahan store (termasuk `selectedIds`/`editingId` yang tak pernah disimpan), dan tiap kali jalan me-reset ulang timer debounce pakai delay milik event PALING BARU saja — bukan "apakah ada doc-change yang masih menunggu". Efeknya: alur wajar "ketik catatan → klik di luar untuk keluar mode edit" (docChanged lalu editingId berubah) membuat event kedua (bukan-dokumen) menimpa jendela cepat 400ms dengan jendela lambat 1500ms; kalau user terus berinteraksi (klik pilih kartu lain, dst) sebelum 1500ms habis, penyimpanan ke IndexedDB tertunda terus-menerus tanpa batas atas — kalau tab ditutup di tengah itu, perubahan belum sempat masuk penyimpanan lokal sama sekali. Direproduksi: baca isi IndexedDB langsung 900ms setelah ketik+klik-luar → `elements: {}` kosong (harusnya sudah tersimpan). Diperbaiki dengan (1) memisahkan "apakah dokumen/kamera berubah" dari "apakah boleh menyentuh timer" — event yang bukan doc & bukan kamera (seleksi, mode-edit) sekarang di-skip total, tak menyentuh timer sama sekali; (2) flag `docSavePending` yang sticky — begitu ada doc-change tertunda, jendela tetap 400ms sampai benar-benar tersimpan, tak bisa mundur ke 1500ms lagi cuma karena event kamera menimpa giliran. Diverifikasi: baca IndexedDB langsung sebelum/sesudah fix (kosong → terisi dalam <1 detik), plus 6 cek Playwright (persist kartu+isi setelah reload, kamera/pan ikut pulih, edit lokal tetap jalan saat `navigator.onLine=false`, app tak crash saat data IndexedDB korup/sengaja dirusak). `sync.ts` (antrean cloud) sudah benar dari awal — watcher-nya sudah gerbang `if (!docChanged) return` di baris pertama, tak kena bug yang sama.

**Gelombang 10 — Minimap:** 8 cek Playwright. **0 bug ditemukan** — tersembunyi di papan kosong, muncul & dot bertambah seiring kartu baru, klik & drag di minimap memindah kamera dunia (kotak viewport ikut), pan langsung di kanvas ikut menggerakkan kotak viewport (sinkron dua arah), zoom mengubah ukuran kotak viewport, dan pindah ke papan baru yang kosong tidak membawa dot dari papan sebelumnya (geometri dihitung ulang per papan, bukan bocor).

**Gelombang 11 — Presentation Mode UI:** 14 cek Playwright (di luar smoke test urutan konektor yang sudah diuji lewat `presentation.test.ts`). **0 bug ditemukan** — papan kosong tak memicu mode presentasi (bukan crash), chrome (Toolbar/TopBar) tersembunyi total selama presentasi, kanvas terkunci (`pointer-events: none` di `#world-layer`, klik di atas kartu tak memilih/menggeser/keluar), tombol Sebelumnya/Berikutnya disabled tepat di ujung urutan, navigasi via tombol maupun keyboard (←/→/spasi/PageUp/PageDown) konsisten, kamera fit ke tiap kartu berbeda per langkah, dan Escape memulihkan kamera persis ke posisi sebelum presentasi dimulai (bukan cuma reset ke default).

**Gelombang 12 — Template starter (isi templat):** 14+2 cek Playwright atas semua 4 templat (Brainstorm, Papan tugas, Catatan rapat, Rencana mingguan). **0 bug ditemukan** — tiap templat: navigasi otomatis ke papan baru, jumlah & tipe kartu sesuai definisi di `lib/templates.ts`, konten Note ter-render (bukan HTML mentah/kosong), judul Task-list sesuai; dipakai berulang (templat sama 2×) tak bentrok ID maupun error konsol.

**Refactor efisiensi performa (bukan spekulatif — diukur dulu):** stress-test PerformanceObserver dengan 150 kartu (naik dari baseline 120 sebelumnya) + pan/zoom/drag berurutan → tetap 0 long-task (>50ms), 0 pageerror. Arsitektur hot-path (kamera via ref, bukan state React; ConnectorLayer redraw imperatif lewat canvasBus, bukan re-render) sudah sehat, jadi tak ada speculative rewrite di area itu. Satu perbaikan algoritmik nyata ditemukan & diperbaiki: `RollupCell`/`FormulaCell` di `DatabaseView.tsx` menerima `rowId` lalu melakukan `db.rows.find(...)` ULANG untuk baris yang sebenarnya SUDAH ada di tangan pemanggil (`db.rows.map((row) => …)`) — untuk tabel dengan kolom rollup/formula, ini O(N) per sel × N baris = O(N²) kerja yang seluruhnya bisa dihindari. Diperbaiki dengan mengoper `row` langsung, bukan `rowId`, ke `RollupCell`/`FormulaCell`/`CellEditor` (aman: `db` sudah disubscribe langsung dari store di komponen induk, jadi `row` yang dioper selalu secepat lookup manual). Diverifikasi: tsc/eslint/33 tes unit/build hijau, plus Playwright — sel biasa & rollup/formula kolom baru tetap tampil tanpa error, dan satu perhitungan formula sum (10+5=15) diverifikasi benar lewat jalur `row` prop baru.

**Gelombang 13 — migrasi IndexedDB:** 11 cek Playwright, tiap kasus di context browser terisolasi penuh (`browser.newContext()`, bukan hapus-database di halaman yang sama — percobaan pertama nge-hang karena `deleteDatabase()` menunggu selamanya sebuah koneksi yang memang tak pernah ditutup app, `lib/idb.ts` menyimpannya di modul-level `dbPromise`). **0 bug ditemukan**: migrasi dari IndexedDB lama (`pinote`) ke baru (`swanote`) jalan & data ikut ditulis ke yang baru; migrasi dari localStorage lama (`milnote:workspace:v1`) ke IndexedDB jalan & localStorage lama dibersihkan setelahnya; data "swanote" yang sudah ada TIDAK ditimpa oleh sumber legacy yang kebetulan juga masih ada (urutan prioritas benar); localStorage lama yang korup (JSON invalid) tak bikin app crash, mulai bersih.

**Gelombang 14 — DnD Kanban & Kalender (re-audit):** 10 cek Playwright. **0 bug ditemukan** setelah investigasi 2 kegagalan awal yang keduanya ternyata bug skrip audit, bukan aplikasi: (1) klik drag di koordinat (x+10,y+10) kartu Kanban jatuh tepat di `<input>` judul kartu — `onPointerDown` KaBoard sengaja menahan drag dari input/select/button, jadi drag tak pernah mulai; diperbaiki dengan klik di bagian bawah kartu, lalu drag terverifikasi benar memindahkan baris antar kolom (termasuk dropdown alternatif non-drag). (2) selector `button[aria-label="Tutup"]` bentrok dengan DUA tombol tutup di halaman (drawer hari Kalender + panel Database), `isViElement` lempar strict-mode violation yang ketangkap diam-diam jadi `false` — screenshot langsung mengonfirmasi drawer SEBENARNYA terbuka dengan benar; diperbaiki dengan scope selector ke kontainer drawer. Setelah kedua fix skrip: Kanban (drag antar kolom + dropdown alternatif) dan Kalender (drag antar hari via tombol +, tap tanpa geser tetap buka drawer bukan dianggap drag) semua terverifikasi benar.

**Semua area yang sebelumnya diidentifikasi sebagai belum diaudit kini sudah tersentuh, kecuali:** sync multi-device sungguhan (butuh kredensial nyata / login magic-link yang tak bisa diotomasi di lingkungan ini — env Supabase memang terisi, tapi menyelesaikan magic-link perlu akses inbox email nyata). Ini satu-satunya item tersisa di antrean audit.

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
