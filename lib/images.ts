"use client";

/** Impor sebuah file gambar jadi data URL yang sudah dikecilkan. Alasan
 *  mengecilkan: kartu disimpan sebagai JSON di localStorage & baris tunggal
 *  Supabase — gambar penuh resolusi cepat menembus batasnya. Sisi terpanjang
 *  dibatasi MAX_DIM dan di-encode ulang (JPEG untuk foto, PNG bila ada
 *  transparansi) supaya ukurannya terjaga. */
const MAX_DIM = 1400;
const JPEG_QUALITY = 0.85;

export interface ImportedImage {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export async function importImageFile(file: File): Promise<ImportedImage | null> {
  if (!file.type.startsWith("image/")) return null;
  let bitmap: ImageBitmap;
  try {
    // File rusak / format tak didukung → jangan lempar promise yang tak
    // tertangani ke picker/drop/paste; cukup batal (null).
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);

    // PNG mempertahankan transparansi; selain itu JPEG jauh lebih ringkas.
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const src = canvas.toDataURL(mime, JPEG_QUALITY);
    return { src, naturalWidth: w, naturalHeight: h };
  } finally {
    bitmap.close();
  }
}

/** Ambil file gambar pertama dari daftar (drop / file picker / clipboard). */
export function firstImageFile(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null;
  for (const f of Array.from(files)) {
    if (f.type.startsWith("image/")) return f;
  }
  return null;
}
