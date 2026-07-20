@AGENTS.md

# Sebelum menambah fitur apa pun

Baca [SPEC.md](SPEC.md) dulu — bukan cuma untuk konteks, tapi karena berisi
keputusan scope yang sudah disepakati (apa yang masuk v1/v1.1/v2, dan kenapa
sesuatu **sengaja** belum dibangun).

## Aturan keras: jangan bangun lompat fase

SPEC.md mendokumentasikan v1.1 dan v2 secara detail supaya desainnya jelas
**saat waktunya tiba** — bukan sebagai izin untuk membangunnya sekarang.
Kalau kamu sedang mengerjakan v1 dan lihat item v1.1/v2 yang kelihatan
mudah/menarik/"selagi di sini", **jangan dikerjakan**. Selesaikan dulu semua
yang berstatus "belum dibangun" di fase yang sedang berjalan (lihat "Status
Implementasi" di SPEC.md), lalu **berhenti dan tanya** ke pemilik project
sebelum lanjut ke fase berikutnya — meski itu berarti sesi berakhir dengan
banyak waktu tersisa. Jangan menafsirkan diamnya user sebagai izin untuk
terus jalan lebih jauh dari yang diminta.

Preseden nyata (baca detailnya di SPEC.md): satu sesi otonom sempat jalan
~5.5 jam tanpa henti dan membangun seluruh sisa v1 sekaligus melompat ke v2
penuh (Database Block + Relations) tanpa pernah berhenti untuk bertanya.
Hasilnya kebetulan berkualitas baik, tapi itu keberuntungan, bukan proses
yang benar — dan butuh sesi terpisah untuk memverifikasi & mendokumentasikan
ulang semuanya setelah fakta. Jangan ulangi pola ini.

## Setelah menambah fitur

Update bagian "Status Implementasi" di SPEC.md supaya dokumen itu tetap jadi
sumber kebenaran, bukan arsip yang basi.
