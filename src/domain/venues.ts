import type { VenueStatus } from "./rules";

export function internalVenueTitle(nazwa: string | null | undefined): string {
  const trimmed = (nazwa ?? "").trim();
  return trimmed || "Szkic bez nazwy";
}

export function pickOwnedVenue<T extends { id: string }>(venues: T[], venueId: string | null | undefined): T | null {
  if (!venueId) return null;
  return venues.find((venue) => venue.id === venueId) ?? null;
}

/** Słowa z prośby właściciela, bez zacierania statusów weryfikacji. */
export function lifecycleGroup(status: VenueStatus): string {
  switch (status) {
    case "draft":
      return "szkic";
    case "published":
      return "aktywny";
    case "archived":
      return "wycofany";
    case "pending_review":
      return "do weryfikacji";
    case "rejected":
      return "odrzucony";
    case "suspended":
      return "zawieszony";
  }
}

/** Opublikowany, niewycofany, bez zawieszenia admina i bez wstrzymania właściciela. */
export function acceptsInquiries(input: {
  published: boolean;
  archived: boolean;
  adminSuspended: boolean;
  ownerPaused: boolean;
}): boolean {
  return input.published && !input.archived && !input.adminSuspended && !input.ownerPaused;
}

export function plainTextProblem(label: string, value: string, max: number): string | null {
  if (value.length > max) return `${label} może mieć najwyżej ${max} znaków.`;
  if (/[<>]/.test(value)) return `${label} nie może zawierać znaczników HTML.`;
  return null;
}
