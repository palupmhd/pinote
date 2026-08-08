"use client";

/** Siapa yang "berhak" atas satu event wheel.
 *
 *  Kanvas memasang SATU listener wheel di container terluar (Canvas.tsx) yang
 *  memanggil preventDefault untuk menggerakkan kamera. Karena listener itu di
 *  fase bubbling, ia menerima wheel dari SELURUH keturunannya — dan
 *  preventDefault di sana membatalkan scroll native untuk seluruh rantai,
 *  termasuk scroller di dalam kartu/modal. Akibatnya (dilaporkan pemilik):
 *  roda mouse di atas isi kartu, tabel database, hasil pencarian, dst selalu
 *  jadi pan kanvas, tak pernah men-scroll benda yang lagi di-hover.
 *
 *  Modul ini yang menjawab "ada yang menyerap scroll ini?" sebelum kamera
 *  bergerak. SENGAJA berbasis computed style + ukuran DOM, bukan daftar
 *  komponen atau atribut penanda: scroller baru otomatis ikut benar tanpa
 *  perlu diingat siapa pun (alasan yang sama dengan aturan :focus-visible
 *  global di globals.css). */

/** Nilai `overflow` yang membuat elemen jadi kotak scroll. "overlay" sudah
 *  usang tapi masih dilaporkan sebagian browser — dimasukkan supaya tak ada
 *  false negative yang sulit dilacak. */
const SCROLLABLE_OVERFLOW = new Set(["auto", "scroll", "overlay"]);

/** 1px slack: scrollHeight/clientHeight dibulatkan ke integer, jadi selisih 1
 *  bisa muncul dari pembulatan pada kartu yang di-scale kamera — bukan konten
 *  yang benar-benar meluber. */
const OVERFLOW_SLACK = 1;

function scrollsAxis(el: HTMLElement, style: CSSStyleDeclaration, axis: "x" | "y"): boolean {
  return axis === "y"
    ? SCROLLABLE_OVERFLOW.has(style.overflowY) &&
        el.scrollHeight - el.clientHeight > OVERFLOW_SLACK
    : SCROLLABLE_OVERFLOW.has(style.overflowX) &&
        el.scrollWidth - el.clientWidth > OVERFLOW_SLACK;
}

/** Elemen scroll terdekat di atas `target` (eksklusif `boundary`) yang relevan
 *  untuk geseran (deltaX, deltaY) — atau null kalau tak ada, artinya kamera
 *  boleh mengambil event-nya.
 *
 *  Posisi scroll TIDAK ikut dicek: begitu ketemu scroller yang cocok sumbunya,
 *  roda jadi miliknya SELAMANYA, termasuk saat sudah mentok di ujung. Ini
 *  pilihan sadar (dikonfirmasi pemilik) — alternatifnya, "chaining" ke pan
 *  kanvas begitu mentok, bikin kanvas melompat tiap kali selesai men-scroll isi
 *  satu kartu, persis di momen orang justru berhenti menggerakkan roda. */
export function scrollAbsorber(
  target: EventTarget | null,
  boundary: HTMLElement,
  deltaX: number,
  deltaY: number
): HTMLElement | null {
  let node: Element | null = target instanceof Element ? target : null;
  while (node && node !== boundary) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      // Sumbu dicek terpisah: pengalih tampilan di header modal database cuma
      // `overflow-x-auto`, dan roda mouse biasa cuma menghasilkan deltaY —
      // benda itu tak boleh menelan scroll vertikal yang bukan haknya.
      if (deltaY !== 0 && scrollsAxis(node, style, "y")) return node;
      if (deltaX !== 0 && scrollsAxis(node, style, "x")) return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** True kalau titik ini berada di dalam panel/modal yang menutupi kanvas
 *  (ditandai `data-canvas-overlay`). Beda dari scrollAbsorber: berlaku juga di
 *  bagian overlay yang TIDAK bisa discroll (header modal, padding, latar
 *  gelapnya) — menggeser kanvas di belakang panel yang lagi dibuka tak pernah
 *  masuk akal, entah bagian mana yang kebetulan ada di bawah kursor. */
export function insideCanvasOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-canvas-overlay]") !== null;
}
