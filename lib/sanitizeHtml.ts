"use client";

/** Sanitasi HTML sebelum di-render lewat dangerouslySetInnerHTML. HTML catatan
 *  ditulis oleh TipTap (StarterKit) yang keluarannya terbatas, TAPI datanya
 *  transit lewat cloud/IndexedDB dan bisa korup/disuntik — jadi batas render
 *  tetap harus disaring. Pendekatan allowlist: hanya tag yang memang dipakai
 *  StarterKit yang dibiarkan, semua atribut dibuang kecuali href aman pada <a>,
 *  sisanya dihapus beserta isinya. */

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "STRONG", "B", "EM", "I", "S", "U", "CODE", "PRE",
  "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "A", "SPAN",
]);

/** Skema yang boleh muncul di href. ALLOWLIST, bukan denylist: daftar skema
 *  berbahaya tak pernah lengkap, dan mencocokkan awalan string mudah dikelabui
 *  (lihat normalisasi di bawah). `board:` = mention papan internal (spec §9.3). */
const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "board:"]);

/** Diekspor supaya properti keamanannya bisa diuji tanpa DOM (sanitizeHtml
 *  sendiri butuh DOMParser). Lihat sanitizeHtml.test.ts. */
export function isSafeUrl(url: string): boolean {
  // Browser MENGABAIKAN tab/LF/CR (dan spasi di tepi) di mana pun dalam URL saat
  // menentukan skema: href="java\tscript:alert(1)" dieksekusi sebagai
  // javascript:. Denylist `startsWith("javascript:")` yang lama lolos di sini
  // karena string mentahnya memang tidak diawali "javascript:" — terbukti bisa
  // dieksploitasi. Buang dulu semua kontrol/spasi sebelum membaca skemanya.
  const v = url.replace(/[\u0000-\u0020]/g, "").toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(v);
  if (!scheme) return true; // relatif / tanpa skema — tak bisa mengeksekusi
  return ALLOWED_SCHEMES.has(`${scheme[1]}:`);
}

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  // querySelectorAll dalam urutan dokumen (leluhur sebelum turunan): menghapus
  // leluhur terlarang ikut membuang turunannya — aman & konservatif.
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const keep =
        el.tagName === "A" && attr.name.toLowerCase() === "href" && isSafeUrl(attr.value);
      if (!keep) el.removeAttribute(attr.name);
    }
  }
  return doc.body.innerHTML;
}
