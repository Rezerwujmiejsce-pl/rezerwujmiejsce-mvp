import Link from "next/link";
import { internalVenueTitle } from "../domain/venues";
import type { OwnerSummary } from "../data/supabase/owner";

/** Lista lokali konta. W Figmie jest jeden lokal, więc to nie jest klatka z makiety. */
export function VenueSwitcher({
  venues,
  currentId,
}: {
  venues: OwnerSummary[];
  currentId?: string;
}) {
  if (venues.length === 0) return null;
  return (
    <nav className="row-actions" aria-label="Lokale tego konta">
      <Link href="/panel">Wszystkie lokale</Link>
      {venues.map((venue) => (
        <Link
          key={venue.id}
          href={`/panel/${venue.id}`}
          aria-current={venue.id === currentId ? "page" : undefined}
        >
          {internalVenueTitle(venue.nazwa)}
        </Link>
      ))}
    </nav>
  );
}
