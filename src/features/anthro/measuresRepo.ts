import { db } from "@/db/db";
import type { AthleteMeasures, MeasureSession } from "@/db/types";
import { todayISO } from "@/lib/dates";

export function newMeasureSession(
  teamId: number,
  date = todayISO(),
): MeasureSession {
  const t = Date.now();
  return { teamId, date, label: "", notes: "", createdAt: t, updatedAt: t };
}

export async function saveMeasureSession(s: MeasureSession): Promise<number> {
  const next = { ...s, updatedAt: Date.now() };
  if (next.id != null) {
    await db.msessions.put(next);
    return next.id;
  }
  return (await db.msessions.add(next)) as number;
}

/** Elimina la rilevazione con tutte le misure. */
export async function deleteMeasureSession(id: number) {
  await db.transaction("rw", db.msessions, db.measures, async () => {
    await db.measures.where("sessionId").equals(id).delete();
    await db.msessions.delete(id);
  });
}

/** Salva le misure di un atleta; se è tutto vuoto le elimina. */
export async function saveAthleteMeasures(
  session: MeasureSession,
  playerId: number,
  values: AthleteMeasures["values"],
  note: string,
) {
  const clean = Object.fromEntries(
    Object.entries(values).filter(
      ([, v]) =>
        v !== "" && v != null && !(typeof v === "number" && Number.isNaN(v)),
    ),
  );
  const old = await db.measures
    .where("[sessionId+playerId]")
    .equals([session.id!, playerId])
    .first();
  if (!Object.keys(clean).length && !note.trim()) {
    if (old?.id != null) await db.measures.delete(old.id);
    return;
  }
  await db.measures.put({
    ...(old ?? {}),
    teamId: session.teamId,
    sessionId: session.id!,
    playerId,
    values: clean,
    note: note.trim(),
    updatedAt: Date.now(),
  });
}

/** Etichetta della rilevazione: nome scelto oppure data breve. */
export function sessionLabel(
  s: Pick<MeasureSession, "date" | "label">,
  short = false,
): string {
  if (s.label) return s.label;
  const d = new Date(`${s.date}T12:00:00`);
  return d.toLocaleDateString(
    "it-IT",
    short
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "long", year: "numeric" },
  );
}

/** Salva un singolo valore (salvataggio immediato durante l'inserimento veloce). undefined = cancella. */
export function setMeasureValue(
  session: MeasureSession,
  playerId: number,
  measureId: string,
  value: number | string | undefined,
) {
  // transazione: i salvataggi rapidi uno dopo l'altro non si sovrascrivono
  return db.transaction("rw", db.measures, async () => {
    const old = await db.measures
      .where("[sessionId+playerId]")
      .equals([session.id!, playerId])
      .first();
    const values = { ...(old?.values ?? {}) };
    if (value === undefined || value === "") delete values[measureId];
    else values[measureId] = value;
    if (!Object.keys(values).length && !old?.note) {
      if (old?.id != null) await db.measures.delete(old.id);
      return;
    }
    await db.measures.put({
      ...(old ?? {}),
      teamId: session.teamId,
      sessionId: session.id!,
      playerId,
      values,
      note: old?.note ?? "",
      updatedAt: Date.now(),
    });
  });
}

export function setMeasureNote(
  session: MeasureSession,
  playerId: number,
  note: string,
) {
  return db.transaction("rw", db.measures, async () => {
    const old = await db.measures
      .where("[sessionId+playerId]")
      .equals([session.id!, playerId])
      .first();
    if (!old && !note.trim()) return;
    if ((old?.note ?? "") === note.trim()) return;
    await db.measures.put({
      ...(old ?? {}),
      teamId: session.teamId,
      sessionId: session.id!,
      playerId,
      values: old?.values ?? {},
      note: note.trim(),
      updatedAt: Date.now(),
    });
  });
}
