/** Nachodzenie przedziałów. Sala pusta oznacza cały lokal. */
export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA;
}

export function sameRoomScope(left: string | null, right: string | null): boolean {
  return left == null || right == null || left === right;
}

export function periodConflicts(
  candidate: { salaId: string | null; start: number; end: number },
  existing: { salaId: string | null; start: number; end: number }[],
): boolean {
  return existing.some(
    (item) =>
      sameRoomScope(candidate.salaId, item.salaId) &&
      intervalsOverlap(candidate.start, candidate.end, item.start, item.end),
  );
}

/** Lokalny czas Warszawy jako UTC. Przesunięcie letnie bierze z zegara systemu. */
export function warsawLocalToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const shown = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"));
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess.getTime() - (shown - wanted));
}

export function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const days: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(first);
    date.setUTCDate(1 - startOffset + index);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

/**
 * `nowe` trzyma termin tylko przed wygasa_o.
 * Brak daty (undefined) oznacza starą bazę bez kolumny: wtedy nowe jeszcze trzyma.
 * null oznacza kolumnę obecną, ale bez terminu — nie trzyma.
 * `zaakceptowane` trzyma niezależnie od zegara i nie jest płatnością.
 */
export function holdsBlock(status: string, expiresAt?: string | null, nowMs = Date.now()): boolean {
  if (status === "zaakceptowane") return true;
  if (status !== "nowe") return false;
  if (expiresAt === undefined) return true;
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > nowMs;
}

export function saturdaysInMonth(isoDate: string, today = ""): string[] {
  const [year, month] = isoDate.split("-").map(Number);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const floor = today || new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return monthGrid(year, month).filter(
    (day) => day.startsWith(prefix) && day >= floor && new Date(`${day}T12:00:00Z`).getUTCDay() === 6,
  );
}
