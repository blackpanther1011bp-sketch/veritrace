import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import type { Grade } from "./types";

export type EventName =
  | "scan"
  | "product_view"
  | "not_found"
  | "details_view"
  | "alternatives_view"
  | "premium_view"
  | "premium_start"
  | "report_sent"
  | "exit_after_bad_grade";

let memorySession: string | null = null;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // repli pour les navigateurs anciens
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("vt_session");
    if (!id) {
      id = newId();
      sessionStorage.setItem("vt_session", id);
    }
    return id;
  } catch {
    memorySession ??= newId();
    return memorySession;
  }
}

interface EventData {
  ean?: string;
  grade?: Grade;
}

function payload(event: EventName, data: EventData) {
  return { session_id: sessionId(), event, ean: data.ean ?? null, grade: data.grade ?? null };
}

/** Enregistre un événement d'usage sans bloquer l'interface. */
export function track(event: EventName, data: EventData = {}): void {
  supabase
    .from("events")
    .insert(payload(event, data))
    .then(({ error }) => {
      if (error) console.warn("Événement non enregistré", error.message);
    });
}

/** Variante utilisée quand la page se ferme : la requête survit à la fermeture. */
export function trackOnExit(event: EventName, data: EventData = {}): void {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload(event, data)),
    }).catch(() => undefined);
  } catch {
    // rien à faire : la mesure d'abandon est non critique
  }
}
