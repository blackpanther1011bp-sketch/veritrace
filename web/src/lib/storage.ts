import type { Grade } from "./types";

export interface HistoryEntry {
  ean: string;
  name: string | null;
  brand: string | null;
  grade: Grade | null;
  at: number;
}

const HISTORY_KEY = "vt_history";
const PREMIUM_KEY = "vt_premium_demo";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée) : l'app fonctionne sans
  }
}

export function getHistory(): HistoryEntry[] {
  const list = read<HistoryEntry[]>(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addToHistory(entry: Omit<HistoryEntry, "at">): void {
  const list = getHistory().filter((e) => e.ean !== entry.ean);
  list.unshift({ ...entry, at: Date.now() });
  write(HISTORY_KEY, list.slice(0, 8));
}

export function isPremium(): boolean {
  return read<boolean>(PREMIUM_KEY, false) === true;
}

export function setPremium(value: boolean): void {
  write(PREMIUM_KEY, value);
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(PREMIUM_KEY);
  } catch {
    // ignoré
  }
}

export function timeAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} jours`;
}
