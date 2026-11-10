import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "../../../components/chrome";
import { Shell } from "../../../components/shell";
import { internalVenueTitle } from "../../../domain/venues";
import { listMine } from "../../../data/supabase/owner";
import { loadSession } from "../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../data/setup";

export default async function OwnerInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  if (env.ok && !session.profile) redirect("/logowanie?next=/panel/zapytania");
  const venues = env.ok && session.profile && session.profile.rola !== "klient" ? await listMine() : null;
  if (venues?.ok && venues.data.length === 1) redirect(`/panel/${venues.data[0].id}/zapytania`);
  return (
    <Shell sharePath="/panel/zapytania">
      <main className="wrap page-pad">
        <p><Link href="/panel">← Twoje lokale</Link></p>
        <div className="subhead">
          <div>
            <h1 className="disp">Zapytania</h1>
            <p className="help">Wybierz lokal. Lista nie miesza zapytań z kilku miejsc. Potwierdzenie terminu i zadatek nie są włączone.</p>
          </div>
        </div>
        <Flash info={params.info} blad={params.blad} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {session.profile?.rola === "klient" ? (
          <p className="notice">To konto nie prowadzi lokalu. Swoje zapytania zobaczysz na <Link href="/konto">koncie</Link>.</p>
        ) : null}
        {venues && !venues.ok ? <p className="notice bad">{venues.detail}</p> : null}
        {venues?.ok && venues.data.length === 0 ? <p className="box">Nie masz jeszcze lokalu, więc nie ma skrzynki zapytań.</p> : null}
        {venues?.ok ? (
          <ul>
            {venues.data.map((venue) => (
              <li key={venue.id}><Link href={`/panel/${venue.id}/zapytania`}>{internalVenueTitle(venue.nazwa)}</Link></li>
            ))}
          </ul>
        ) : null}
      </main>
    </Shell>
  );
}
