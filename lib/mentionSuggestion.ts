"use client";

import Mention from "@tiptap/extension-mention";
import type { SuggestionOptions } from "@tiptap/suggestion";
import { useCanvasStore } from "./store";

/** Mention board ala Obsidian (spec §9.3): ketik `@` di Note → dropdown papan →
 *  sisip node mention. Node dirender sebagai `<a href="board:<id>">@Judul</a>`
 *  supaya (1) lolos sanitizer HTML (skema board: aman), (2) bisa diklik untuk
 *  navigasi di render statis, dan (3) jadi sumber turunan backlink (§9.3). */

interface Item {
  id: string;
  label: string;
}

const suggestion: Omit<SuggestionOptions<Item>, "editor"> = {
  char: "@",
  items: ({ query }) => {
    const boards = Object.values(useCanvasStore.getState().boards);
    const q = query.toLowerCase();
    return boards
      .filter((b) => b.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 8)
      .map((b) => ({ id: b.id, label: b.title }));
  },
  command: ({ editor, range, props }) => {
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        { type: "mention", attrs: { id: props.id, label: props.label } },
        { type: "text", text: " " },
      ])
      .run();
  },
  render: () => {
    let root: HTMLDivElement | null = null;
    let items: Item[] = [];
    let selected = 0;
    let command: ((item: Item) => void) | null = null;

    const place = (rect?: (() => DOMRect | null) | null) => {
      if (!root || !rect) return;
      const r = rect();
      if (!r) return;
      root.style.left = `${r.left}px`;
      root.style.top = `${r.bottom + 4}px`;
    };
    const paint = () => {
      if (!root) return;
      root.innerHTML = "";
      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "mention-item mention-empty";
        empty.textContent = "Tak ada papan";
        root.appendChild(empty);
        return;
      }
      items.forEach((it, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mention-item" + (i === selected ? " is-active" : "");
        b.textContent = it.label || "(tanpa judul)";
        // mousedown (bukan click): jangan sampai editor blur duluan.
        b.addEventListener("mousedown", (e) => {
          e.preventDefault();
          command?.(it);
        });
        root!.appendChild(b);
      });
    };

    return {
      onStart: (props) => {
        items = props.items;
        command = props.command;
        selected = 0;
        root = document.createElement("div");
        root.className = "mention-popup";
        document.body.appendChild(root);
        place(props.clientRect);
        paint();
      },
      onUpdate: (props) => {
        items = props.items;
        command = props.command;
        selected = 0;
        place(props.clientRect);
        paint();
      },
      onKeyDown: (props) => {
        const k = props.event.key;
        if (k === "ArrowDown") {
          selected = (selected + 1) % Math.max(items.length, 1);
          paint();
          return true;
        }
        if (k === "ArrowUp") {
          selected = (selected - 1 + items.length) % Math.max(items.length, 1);
          paint();
          return true;
        }
        if (k === "Enter") {
          if (items[selected]) command?.(items[selected]);
          return true;
        }
        if (k === "Escape") {
          root?.remove();
          root = null;
          return true;
        }
        return false;
      },
      onExit: () => {
        root?.remove();
        root = null;
      },
    };
  },
};

/** Node mention khusus board: dirender & di-parse sebagai `<a data-type="mention">`.
 *  Prioritas parse dinaikkan supaya menang atas mark Link bawaan StarterKit. */
export const BoardMention = Mention.extend({
  parseHTML() {
    return [{ tag: 'a[data-type="mention"]', priority: 60 }];
  },
  renderHTML({ node }) {
    const id = String(node.attrs.id ?? "");
    const label = String(node.attrs.label ?? id);
    return [
      "a",
      {
        href: `board:${id}`,
        "data-type": "mention",
        "data-id": id,
        "data-label": label,
        class: "mention",
      },
      `@${label}`,
    ];
  },
}).configure({ suggestion });
