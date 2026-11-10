import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flash } from "../../../../components/chrome";
import { Shell } from "../../../../components/shell";
import { internalVenueTitle } from "../../../../domain/venues";
import { getMine } from "../../../../data/supabase/owner";
import { loadSession } from "../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../data/setup";
import { archiveOwnVenue } from "../../actions";

export default async function WithdrawVenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const path = `/panel/${id}/wycofaj`;
  const env = readPublicEnv();
  if (!env.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></main></Shell>;
  }
  const session = await loadSession();
  if (!session.profile) redirect(`/logowanie?next=${encodeURIComponent(path)}`);
  const venue = await getMine(id);
  if (!venue.ok) {
    return <Shell sharePath={path}><main className="wrap page-pad"><p className="notice bad">{venue.detail}</p></main></Shell>;
  }
  if (!venue.data) notFound();
  const isOwner = venue.data.czlonkowie.some((member) => member.profil_id === session.profile?.id && member.rola === "wlasciciel");
  return (
    <Shell sharePath={path}>
      <main className="wrap page-pad">
        <p><Link href={`/panel/${id}`}>← {internalVenueTitle(venue.data.nazwa)}</Link></p>
        <h1 className="disp">Wycofaj lokal z serwisu</h1>
        <Flash info={query.info} blad={query.blad} />
        <div className="box">
          <p>Wycofanie zdejmuje lokal z wyszukiwania, mapy i strony publicznej. Zdjęcia przestają być publiczne. Wiersz lokalu i dotychczasowe zapytania zostają w panelu. Rekord nie jest kasowany.</p>
          <p>To nie jest „Wstrzymaj lokal”. Wstrzymanie zostawia stronę widoczną i tylko blokuje nowe zapytania.</p>
          <p className="help">W Figmie nie ma ekranu usuwania lokalu. Ten krok jest świadomym dodatkiem.</p>
        </div>
        {venue.data.status === "archived" ? <p className="notice">Ten lokal jest już wycofany.</p> : null}
        {isOwner && venue.data.status !== "archived" ? (
          <form action={archiveOwnVenue} className="stack">
            <input type="hidden" name="id" value={id} />
            <label><input type="checkbox" name="potwierdz" value="tak" /> Potwierdzam wycofanie tego lokalu z serwisu.</label>
            <button className="btn" type="submit">Wycofaj lokal</button>
          </form>
        ) : null}
        {!isOwner ? <p className="notice">Wycofać lokal może tylko jego właściciel.</p> : null}
      </main>
    </Shell>
  );
}
