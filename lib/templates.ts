/** Template starter (spec v1.1): papan siap-pakai dengan kartu tertata. Dipakai
 *  addBoardFromTemplate di store — sengaja hanya Note & Task-list supaya
 *  mandiri (tanpa aset/entitas eksternal seperti gambar/database). */
export type TemplateCard =
  | { type: "NOTE"; x: number; y: number; width?: number; html: string }
  | { type: "TASK_LIST"; x: number; y: number; width?: number; title: string; items: string[] };

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  title: string; // judul papan yang dibuat
  cards: TemplateCard[];
}

const note = (x: number, y: number, html: string, width?: number): TemplateCard => ({
  type: "NOTE",
  x,
  y,
  width,
  html,
});
const tasks = (x: number, y: number, title: string, items: string[]): TemplateCard => ({
  type: "TASK_LIST",
  x,
  y,
  title,
  items,
});

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "Satu pertanyaan pemantik + beberapa kartu ide kosong",
    title: "Brainstorm",
    cards: [
      note(40, 40, "<p><strong>Pertanyaan:</strong> apa yang mau dipecahkan?</p>", 300),
      note(40, 200, "<p>Ide 1…</p>"),
      note(320, 200, "<p>Ide 2…</p>"),
      note(600, 200, "<p>Ide 3…</p>"),
    ],
  },
  {
    id: "kanban",
    name: "Papan tugas",
    description: "Tiga kolom: Backlog · Dikerjakan · Selesai",
    title: "Papan tugas",
    cards: [
      tasks(40, 40, "Backlog", ["", ""]),
      tasks(320, 40, "Dikerjakan", [""]),
      tasks(600, 40, "Selesai", [""]),
    ],
  },
  {
    id: "meeting",
    name: "Catatan rapat",
    description: "Agenda, action items, dan catatan bebas",
    title: "Catatan rapat",
    cards: [
      note(40, 40, "<p><strong>Agenda</strong></p><p>1. …</p><p>2. …</p>", 300),
      tasks(360, 40, "Action items", ["", ""]),
      note(40, 260, "<p><strong>Catatan</strong></p><p>…</p>", 620),
    ],
  },
  {
    id: "weekly",
    name: "Rencana mingguan",
    description: "Kartu tujuan + daftar per fokus",
    title: "Rencana mingguan",
    cards: [
      note(40, 40, "<p><strong>Fokus minggu ini</strong></p><p>…</p>", 300),
      tasks(40, 200, "Harus selesai", ["", ""]),
      tasks(320, 200, "Kalau sempat", [""]),
    ],
  },
];
