import { useCallback, useEffect, useState } from "react";

const KEY = "fivesom-favorites";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<(ids: string[]) => void>();

function write(ids: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  listeners.forEach((l) => l(ids));
}

/** Saved gigs. Stored on the device — the FIVESOM database has no favorites table yet. */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const l = (next: string[]) => setIds(next);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const current = read();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    write(next);
    return next.includes(id);
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, isFavorite };
}

const SEARCH_KEY = "fivesom-recent-searches";

export function useRecentSearches() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SEARCH_KEY);
      setItems(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setItems([]);
    }
  }, []);

  const push = useCallback((term: string) => {
    const t = term.trim();
    if (!t) return;
    setItems((prev) => {
      const next = [t, ...prev.filter((p) => p.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      window.localStorage.setItem(SEARCH_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(SEARCH_KEY);
    setItems([]);
  }, []);

  return { items, push, clear };
}
