/** Urutan "jalur cerita" untuk Presentation Mode (spec §9.2/§10.2): ikuti arah
 *  Connector. Mulai dari kartu tanpa panah masuk (sumber), telusuri panah
 *  keluar (DFS), lalu sisipkan sisa kartu (terisolasi / dalam siklus) di akhir —
 *  jadi tiap kartu muncul tepat sekali dan tak ada yang terlewat. Tanpa
 *  konektor sama sekali → urut baca (atas-ke-bawah, kiri-ke-kanan). */
export function buildPresentationOrder(
  cards: { id: string; x: number; y: number }[],
  connectors: { sourceElementId: string; targetElementId: string }[]
): string[] {
  const ids = new Set(cards.map((c) => c.id));
  const pos = new Map(cards.map((c) => [c.id, c]));
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const c of cards) {
    out.set(c.id, []);
    indeg.set(c.id, 0);
  }
  for (const e of connectors) {
    if (!ids.has(e.sourceElementId) || !ids.has(e.targetElementId)) continue;
    out.get(e.sourceElementId)!.push(e.targetElementId);
    indeg.set(e.targetElementId, (indeg.get(e.targetElementId) ?? 0) + 1);
  }

  const byPos = (a: string, b: string) => {
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    return pa.y - pb.y || pa.x - pb.x;
  };
  for (const list of out.values()) list.sort(byPos);

  const visited = new Set<string>();
  const order: string[] = [];
  const stack: string[] = [];
  const dfs = (start: string) => {
    // Iteratif supaya papan besar tak menabrak batas rekursi.
    stack.push(start);
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      order.push(id);
      const next = out.get(id)!;
      for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]); // jaga urutan
    }
  };

  const sorted = cards.map((c) => c.id).sort(byPos);
  for (const id of sorted) if ((indeg.get(id) ?? 0) === 0) dfs(id);
  for (const id of sorted) if (!visited.has(id)) dfs(id);
  return order;
}
