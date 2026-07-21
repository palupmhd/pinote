"use client";

import { toPng } from "html-to-image";
import { useCanvasStore } from "./store";
import type { CardElement } from "./types";

const PAD = 40; // ruang kosong di tepi (world units)
const BG = "#f5f5f5"; // samakan dengan latar kanvas (bg-neutral-100)

/** Ekspor papan yang sedang dibuka jadi berkas PNG (spec §6 gap #4a).
 *
 *  Menangkap SELURUH isi papan, bukan cuma viewport: hitung kotak-batas semua
 *  kartu, lalu render `#world-layer` dengan transform diganti sementara oleh
 *  html-to-image (geser origin ke pojok kotak, skala 1) — jadi pan/zoom saat
 *  ini tidak memengaruhi hasil, dan tak ada kedipan di layar (yang dimanipulasi
 *  cuma klon di dalam library). Grid titik dikecualikan lewat filter. */
export async function exportBoardPng(): Promise<{ ok: boolean; reason?: string }> {
  const world = document.getElementById("world-layer");
  if (!world) return { ok: false, reason: "kanvas belum siap" };

  const s = useCanvasStore.getState();
  const cards = Object.values(s.elements).filter(
    (e): e is CardElement => e.boardId === s.currentBoardId && e.type !== "CONNECTOR"
  );
  if (cards.length === 0) return { ok: false, reason: "papan kosong" };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cards) {
    // Tinggi tak ada di data (ikut isi) → ukur dari DOM, seperti ConnectorLayer.
    const node = document.querySelector<HTMLElement>(`[data-element-id="${c.id}"]`);
    const h = node?.offsetHeight ?? 80;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.width);
    maxY = Math.max(maxY, c.y + h);
  }
  minX -= PAD;
  minY -= PAD;
  maxX += PAD;
  maxY += PAD;
  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));

  const title = s.boards[s.currentBoardId]?.title?.trim() || "papan";

  try {
    const dataUrl = await toPng(world, {
      width,
      height,
      backgroundColor: BG,
      pixelRatio: 2,
      style: {
        transform: `translate(${-minX}px, ${-minY}px) scale(1)`,
        transformOrigin: "0 0",
      },
      // Jangan sertakan grid titik (elemen raksasa & jadi noise di ekspor).
      filter: (node) =>
        !(node instanceof HTMLElement && node.dataset.exportIgnore === "true"),
    });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title}.png`;
    a.click();
    return { ok: true };
  } catch (e) {
    // Penyebab tersering: gambar dari domain lain (mis. pratinjau tautan) yang
    // "menodai" canvas sehingga tak bisa di-export. Sampaikan apa adanya.
    return { ok: false, reason: e instanceof Error ? e.message : "gagal mengekspor" };
  }
}
