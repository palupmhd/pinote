"use client";

import { useEffect, useRef, type RefObject } from "react";
import { GRID } from "./types";

/** Bulatkan tinggi ALAMI kartu (konten, bukan yang di-resize manual) ke ATAS
 *  ke kelipatan GRID lewat padding-bottom tambahan — supaya jarak antar
 *  kartu yang ditumpuk selalu konsisten, bukan tergantung sisa piksel acak
 *  dari tinggi konten organik (jumlah baris teks, item tugas, dst). Posisi
 *  kartu (x/y) sudah kelipatan grid lewat snap drag; tanpa ini, tinggi yang
 *  TIDAK kelipatan grid bikin jarak ke kartu di bawahnya beda-beda tiap kartu
 *  meski keduanya sama-sama "menempel".
 *
 *  Cuma menambah padding (tak pernah mengurangi) — konten tak pernah
 *  kepotong. Padding dasar (dari class Tailwind, mis. `pb-3`) diukur SEKALI
 *  lewat computed style sebelum kita sentuh, lalu semua tulisan berikutnya
 *  aditif dari situ — supaya tak perlu tahu angka padding tiap pemanggil.
 *  Padding ekstra yang kita tulis sendiri dikurangi lagi sebelum menghitung
 *  tinggi "alami" berikutnya, jadi ResizeObserver stabil (tak pernah
 *  memicu dirinya sendiri berulang).
 *
 *  `enabled=false` (kartu sedang punya tinggi eksplisit dari ResizeHandle,
 *  yang sudah kelipatan grid) — lepas observer & bersihkan padding
 *  tambahan supaya tak dobel dengan tinggi eksplisit itu. */
export function useSnapAutoHeight(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const basePad = useRef<number | null>(null);
  const appliedExtra = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled) {
      if (appliedExtra.current !== 0 || basePad.current !== null) {
        appliedExtra.current = 0;
        basePad.current = null;
        el.style.paddingBottom = "";
      }
      return;
    }

    if (basePad.current === null) {
      basePad.current = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    }

    const apply = () => {
      const natural = el.offsetHeight - appliedExtra.current;
      const rounded = Math.ceil(natural / GRID) * GRID;
      const extra = rounded - natural;
      if (extra !== appliedExtra.current) {
        appliedExtra.current = extra;
        el.style.paddingBottom = `${(basePad.current ?? 0) + extra}px`;
      }
    };

    // ResizeObserver TIDAK bisa diandalkan memicu callback pertamanya sendiri
    // di semua browser buat elemen yang ukurannya sudah stabil sejak mount
    // (diverifikasi langsung: observer baru pada elemen diam tidak pernah
    // terpanggil) — tanpa baris ini, kartu yang tak pernah berubah ukuran
    // sesudah mount (kasus paling umum: kartu baru langsung diisi lalu diam)
    // tak pernah dibulatkan sama sekali. Panggil sekali di sini buat baseline,
    // observer di bawah cuma menyusul perubahan SETELAHNYA (mengetik, dst).
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled]);
}
