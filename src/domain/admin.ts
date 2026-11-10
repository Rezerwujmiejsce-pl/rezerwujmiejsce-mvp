import type { VenueStatus } from "./rules";

export const ADMIN_PAGE_SIZE = 20;

const VENUE_STATUSES: VenueStatus[] = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "archived",
  "suspended",
];

const INQUIRY_STATUSES = ["nowe", "zaakceptowane", "odrzucone", "anulowane", "wygasle", "inny_termin"];

export function adminPageNumber(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 500) return 1;
  return value;
}

export function adminVenueStatusFilter(raw: string | undefined): VenueStatus | "" {
  return VENUE_STATUSES.includes(raw as VenueStatus) ? (raw as VenueStatus) : "";
}

export function adminInquiryStatusFilter(raw: string | undefined): string {
  return INQUIRY_STATUSES.includes(raw ?? "") ? (raw as string) : "";
}

export function plainCityFilter(raw: string | undefined): string {
  return (raw ?? "").replace(/[%_\\]/g, "").trim().slice(0, 80);
}

export function isoDayFilter(raw: string | undefined): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw ?? "") ? (raw as string) : "";
}

/** Nazwa z profilu. Brak nazwy nie jest zastępowany adresem e-mail. */
export function ownerDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed || "Brak nazwy w profilu";
}

export function formatWarsawStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
