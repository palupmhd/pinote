import { NextResponse } from "next/server";

const TIMEOUT_MS = 6000;
const MAX_BYTES = 512 * 1024; // cukup untuk <head>; jangan tarik halaman raksasa

/** Route ini mengambil URL dari sisi server, jadi bisa dipakai untuk mengintip
 *  jaringan internal (SSRF). Tolak apa pun yang bukan http(s) publik.
 *  Catatan: cek berbasis hostname tidak kebal DNS rebinding — cukup untuk alat
 *  pribadi, perlu diperketat kalau nanti dibuka untuk umum. */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // metadata cloud
  return false;
}

const pick = (html: string, patterns: RegExp[]): string | null => {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decode(m[1].trim()).slice(0, 300);
  }
  return null;
};

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const meta = (prop: string) => [
  new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
  new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
];

const MAX_REDIRECTS = 5;

/** Ikuti redirect secara manual dan validasi TIAP hop. `redirect: "follow"`
 *  bawaan hanya sempat kita cek di URL awal — situs publik bisa me-redirect ke
 *  localhost / 169.254.x.x / IP privat dan server tetap menariknya (SSRF).
 *  Di sini setiap tujuan dicek dulu sebelum di-fetch. */
async function safeFetch(start: URL): Promise<{ res: Response; url: URL } | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      return null;
    }
    const res = await fetch(url, {
      headers: { "user-agent": "MilnoteBot/0.1 (+link preview)", accept: "text/html,*/*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {}); // buang body redirect
      if (!loc) return { res, url }; // 3xx tanpa Location → perlakukan apa adanya
      let next: URL;
      try {
        next = new URL(loc, url); // Location bisa relatif
      } catch {
        return null;
      }
      url = next;
      continue;
    }
    return { res, url };
  }
  return null; // terlalu banyak redirect
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url wajib diisi" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(target.protocol) || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "URL tidak diizinkan" }, { status: 400 });
  }

  try {
    const fetched = await safeFetch(target);
    if (!fetched) {
      return NextResponse.json({ error: "URL tidak diizinkan" }, { status: 400 });
    }
    const { res, url: finalUrl } = fetched;
    if (!res.ok) {
      return NextResponse.json({ url: finalUrl.href, title: finalUrl.hostname }, { status: 200 });
    }

    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let size = 0;
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break; // metadata sudah lewat, hentikan
      }
      await reader.cancel().catch(() => {});
    }

    const image = pick(html, meta("og:image"));
    return NextResponse.json({
      url: finalUrl.href,
      title:
        pick(html, meta("og:title")) ??
        pick(html, [/<title[^>]*>([^<]+)<\/title>/i]) ??
        finalUrl.hostname,
      description: pick(html, meta("og:description")) ?? pick(html, meta("description")),
      image: image ? new URL(image, finalUrl).href : null,
      siteName: pick(html, meta("og:site_name")) ?? finalUrl.hostname,
    });
  } catch {
    // Situs mati/lambat/blokir bot — tetap simpan tautannya, jangan gagal total.
    return NextResponse.json({ url: target.href, title: target.hostname });
  }
}
