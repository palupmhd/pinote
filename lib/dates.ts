/** Utilitas tanggal "hari" (bukan momen): tenggat tugas disimpan sebagai
 *  string lokal "YYYY-MM-DD" supaya tidak tergeser zona waktu. */

/** Tanggal hari ini di zona lokal, "YYYY-MM-DD". */
export function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-07-20" → "20 Jul". String kosong/invalid → "". */
export function formatShort(due: string | null | undefined): string {
  if (!due) return "";
  const [y, m, d] = due.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1] ?? ""}`.trim();
}

/** Selisih hari (target − hari ini), berbasis kalender lokal. */
export function daysFromToday(due: string): number {
  const [y, m, d] = due.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}
