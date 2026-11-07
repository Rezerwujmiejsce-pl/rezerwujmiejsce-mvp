import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { VenueEditor } from "../../../components/venue-editor";
import { listAmenities, listOccasions } from "../../../data/supabase/catalog";
import { getMine } from "../../../data/supabase/owner";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function EditVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={`/panel/${id}`}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=/panel/${id}`);
  const [venue, occasions, amenities] = await Promise.all([getMine(id), listOccasions(), listAmenities()]);
  if (!venue.ok) {
    return <Shell sharePath={`/panel/${id}`}><main className="wrap page-pad"><p className="notice bad">{venue.detail}</p></main></Shell>;
  }
  if (!venue.data) notFound();
  return (
    <Shell sharePath={`/panel/${id}`}>
      <main className="wrap page-pad">
        <p><Link href="/panel">← Twoje lokale</Link></p>
        <Flash info={query.info} blad={query.blad} />
        <VenueEditor
          venue={venue.data}
          occasions={occasions.ok ? occasions.data : []}
          amenities={amenities.ok ? amenities.data : []}
        />
      </main>
    </Shell>
  );
}
