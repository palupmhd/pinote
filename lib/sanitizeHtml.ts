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

function isSafeUrl(url: string): boolean {
  const v = url.trim().toLowerCase();
  // Cegah skema yang bisa mengeksekusi (javascript:, data:, vbscript:).
  return !v.startsWith("javascript:") && !v.startsWith("data:") && !v.startsWith("vbscript:");
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
