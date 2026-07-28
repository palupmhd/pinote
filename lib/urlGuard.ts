/** Penjaga URL sisi server untuk `/api/link-preview`.
 *
 *  Dipisah dari route-nya supaya bisa diuji langsung (lihat urlGuard.test.ts):
 *  ini kode keamanan, dan versi sebelumnya punya lubang yang lolos berbulan-bulan
 *  justru karena tak pernah ada tes yang menyentuhnya. */

/** Host yang TIDAK boleh di-fetch server: loopback, jaringan privat, dan
 *  metadata cloud. Route ini mengambil URL dari sisi server, jadi tanpa
 *  penjagaan bisa dipakai mengintip jaringan internal (SSRF).
 *
 *  Catatan: cek berbasis hostname tidak kebal DNS rebinding — cukup untuk alat
 *  pribadi, perlu diperketat (resolve dulu lalu cek IP hasilnya) kalau nanti
 *  dibuka untuk umum. */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // URL.hostname mengembalikan IPv6 literal LENGKAP DENGAN kurung siku ("[::1]"),
  // jadi perbandingan `h === "::1"` yang lama TIDAK PERNAH cocok — "[::1]",
  // "[::ffff:127.0.0.1]" (loopback ter-map), "[fd00::1]", "[fe80::1]" semuanya
  // lolos. Tolak semua IPv6 literal: mengurai IPv6 dengan benar (bentuk ter-map,
  // ter-kompres, zona) rawan salah, sementara situs publik selalu bisa dicapai
  // lewat nama host — jadi menolak literal nyaris tanpa biaya.
  if (h.startsWith("[")) return true;

  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0") return true;
  // Bentuk desimal/oktal/heksa (mis. http://2130706433/) tak perlu ditangani
  // khusus: parser URL WHATWG sudah menormalkannya jadi dotted-quad sebelum
  // sampai ke sini — diverifikasi di tes.
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // metadata cloud
  return false;
}
