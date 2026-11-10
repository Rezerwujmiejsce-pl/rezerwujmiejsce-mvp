import { formatZloty } from "./rules";

export type InquiryStatus = "nowe" | "inny_termin" | "odrzucone" | "wygasle" | "zaakceptowane";

export function inquiryStatusLabel(status: string): string {
  switch (status) {
    case "nowe":
      return "Czeka na lokal";
    case "odrzucone":
      return "Odrzucone";
    case "inny_termin":
      return "Inny termin";
    case "wygasle":
      return "Wygasłe";
    case "zaakceptowane":
      return "Zaakceptowane w bazie";
    default:
      return "Status nieznany";
  }
}

/** Szacunek tylko z opublikowanego cennika sali. Godzina, dzień i pakiet nie dają jednej kwoty. */
export function estimateFromRoom(input: {
  unit: string | null;
  grosze: number | null;
  onRequest: boolean;
  guests: number;
}): number | null {
  if (input.onRequest || input.grosze == null || input.grosze < 0 || input.guests < 1) return null;
  if (input.unit === "za_osobe") {
    const total = input.grosze * input.guests;
    return Number.isSafeInteger(total) && total <= 2_000_000_000 ? total : null;
  }
  if (input.unit === "za_sale") return input.grosze;
  return null;
}

export function estimateNote(grosze: number | null): string {
  if (grosze == null) {
    return "Brak jednej kwoty z cennika. Ceny za godzinę, dzień i pakiet oraz „cena na zapytanie” nie są przeliczane na sumę.";
  }
  return `${formatZloty(grosze)} z cennika sali. To nie jest zadatek ani płatność.`;
}

export function isoDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function formatInquiryWhen(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const stamp = new Date(Date.UTC(year, month - 1, day, 12));
  const label = new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(stamp);
  return `${label}, ${time.slice(0, 5)}`;
}

export function shortAccountLabel(name: string | null, email: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].slice(0, 1)}.`;
  if (parts.length === 1) return parts[0];
  const local = email?.split("@")[0]?.trim();
  return local || "Konto";
}

export function guestCountLabel(count: number): string {
  if (count === 1) return "1 osoba";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} osoby`;
  return `${count} osób`;
}

export function firstName(name: string | null): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || null;
}

export function inquiryProblems(input: {
  guests: number | null;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  roomId: string;
  today: string;
  roomCapacity: number | null;
}): string[] {
  const problems: string[] = [];
  if (!/^[0-9a-f-]{36}$/i.test(input.roomId)) problems.push("Wybierz salę.");
  if (input.guests == null || input.guests < 1 || input.guests > 5000) {
    problems.push("Podaj liczbę gości od 1 do 5000.");
  } else if (input.roomCapacity != null && input.guests > input.roomCapacity) {
    problems.push("Ta sala nie mieści tylu gości.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    problems.push("Podaj datę.");
  } else if (input.date < input.today || input.date > addIsoDays(input.today, 540)) {
    problems.push("Data musi być dzisiaj albo w ciągu najbliższych 18 miesięcy.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) problems.push("Podaj godzinę.");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) problems.push("Podaj imię i nazwisko (2–120 znaków).");
  const phone = input.phone.trim();
  if (phone.length < 7 || phone.length > 32 || !/^[0-9 +()-]+$/.test(phone)) problems.push("Podaj numer telefonu.");
  const email = input.email.trim();
  if (email.length < 5 || email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    problems.push("Podaj adres e-mail.");
  }
  if (input.message.trim().length > 2000) problems.push("Wiadomość może mieć najwyżej 2000 znaków.");
  return problems;
}
