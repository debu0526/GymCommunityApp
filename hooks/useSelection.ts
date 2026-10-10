/** Reusable multi-select state for iOS-style select-and-delete lists. */
import { useState } from 'react';

export function useSelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const enter = (id: string) => { setSelecting(true); setIds(new Set([id])); };
  const toggle = (id: string) =>
    setIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => { setSelecting(false); setIds(new Set()); };

  return {
    selecting,
    ids,
    count: ids.size,
    isSelected: (id: string) => ids.has(id),
    enter,
    toggle,
    clear,
  };
}
