export const PHOTO_MAX_BYTES = 8_000_000;

export const VENUE_TYPES = [
  ["restauracja", "Restauracja"],
  ["bawialnia", "Bawialnia"],
  ["sala_bankietowa", "Sala bankietowa"],
  ["kawiarnia", "Kawiarnia"],
  ["dworek", "Dworek"],
  ["klub", "Klub"],
  ["inne", "Inny"],
] as const;

export const PRICE_UNITS = [
  ["za_sale", "za salę"],
  ["za_osobe", "za osobę"],
  ["za_dzien", "za dzień"],
  ["za_godzine", "za godzinę"],
  ["za_pakiet", "za pakiet"],
] as const;

export const GUEST_UNITS = [
  ["osoby", "osób"],
  ["dzieci", "dzieci"],
] as const;

export type VenueStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";
export type SubmissionState = "none" | "pending_review" | "rejected";
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export function statusLabel(
  status: VenueStatus,
  submission: SubmissionState,
  dirty: boolean,
): string {
  if (status === "published" && submission === "pending_review") {
    return "Opublikowany · zmiany czekają na sprawdzenie";
  }
  if (status === "published" && submission === "rejected") {
    return "Opublikowany · ostatnie zmiany odrzucone";
  }
  if (status === "published" && dirty) {
    return "Opublikowany · masz zmiany niewysłane do sprawdzenia";
  }
  switch (status) {
    case "draft":
      return "Szkic";
    case "pending_review":
      return "Do weryfikacji";
    case "published":
      return "Opublikowany";
    case "rejected":
      return "Odrzucony";
    case "archived":
      return "Wycofany z serwisu";
  }
}

export function typeLabel(typ: string): string {
  return VENUE_TYPES.find(([value]) => value === typ)?.[1] ?? "Lokal";
}

export function unitLabel(unit: string | null | undefined): string {
  return PRICE_UNITS.find(([value]) => value === unit)?.[1] ?? "za salę";
}

export function guestLabel(unit: string | null | undefined): string {
  return unit === "dzieci" ? "dzieci" : "osób";
}

export function formatZloty(grosze: number): string {
  const zloty = grosze / 100;
  const digits = grosze % 100 === 0 ? 0 : 2;
  return `${new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(zloty)} zł`;
}

export function priceLine(
  grosze: number | null,
  unit: string | null,
  onRequest: boolean,
): string {
  if (grosze == null) return "cena na zapytanie";
  const base = `od ${formatZloty(grosze)} ${unitLabel(unit)}`;
  return onRequest ? `${base} · jest też sala z ceną na zapytanie` : base;
}

export function zlotyToGrosze(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const grosze = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(grosze) || grosze > 100_000_000) return null;
  return grosze;
}

export function groszeToInput(grosze: number | null): string {
  if (grosze == null) return "";
  const zloty = grosze / 100;
  return grosze % 100 === 0 ? String(zloty) : zloty.toFixed(2).replace(".", ",");
}

export type RoomDraft = {
  nazwa: string;
  widoczna: boolean;
  pojemnosc: number | null;
  cenaUstalona: boolean;
};

/** Progi tymczasowe: nazwa, miasto, jedna widoczna sala i decyzja cenowa. Bez progu zdjęć i bez procentu kompletności. */
export function submitBlockers(input: {
  nazwa: string;
  miasto: string;
  rooms: RoomDraft[];
}): string[] {
  const errors: string[] = [];
  if (input.nazwa.trim().length < 2) errors.push("Podaj nazwę lokalu (przynajmniej 2 znaki).");
  if (input.miasto.trim().length < 2) errors.push("Podaj miasto.");
  const visible = input.rooms.filter((room) => room.widoczna);
  if (!visible.some((room) => room.nazwa.trim().length >= 1 && room.pojemnosc != null && room.pojemnosc >= 1)) {
    errors.push("Dodaj przynajmniej jedną widoczną salę z nazwą i liczbą gości.");
  }
  if (visible.some((room) => !room.cenaUstalona)) {
    errors.push("Każda widoczna sala potrzebuje kwoty albo oznaczenia „cena na zapytanie”.");
  }
  return errors;
}

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (bytes.length > PHOTO_MAX_BYTES) return null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionFor(mime: ImageMime): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function safeNextPath(raw: string | null | undefined, fallback = "/panel"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return fallback;
  }
  return raw;
}

export function parsePositiveInt(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 5000) return null;
  return value;
}

export function hourLabel(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}
