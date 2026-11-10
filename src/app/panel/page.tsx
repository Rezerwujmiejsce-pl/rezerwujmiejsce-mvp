import Link from "next/link";
import { Flash } from "../../components/chrome";
import { Shell } from "../../components/shell";
import { statusLabel } from "../../domain/rules";
import { internalVenueTitle } from "../../domain/venues";
import { listMine } from "../../data/supabase/owner";
import { loadSession } from "../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../data/setup";
import { createVenue } from "./actions";

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const env = readPublicEnv();
  const session = await loadSession();
  const venues = env.ok && session.profile ? await listMine() : null;
  return (
    <Shell sharePath="/panel">
      <main className="wrap page-pad">
        <h1 className="disp">Twoje lokale</h1>
        <p className="help">Jedno konto może prowadzić kilka lokali. W Figmie panel jest narysowany dla jednego miejsca, więc przełącznik poniżej jest dodatkiem, nie kopią makiety. Tekst strony głównej serwisu ustawia tylko administrator.</p>
        <Flash info={params.info} blad={params.blad} />
        {!env.ok ? <p className="notice bad">{setupMessage(env.missing)}</p> : null}
        {env.ok && !session.profile ? <p>Najpierw <Link href="/logowanie?next=/panel">zaloguj się</Link>.</p> : null}
        {session.profile?.rola === "klient" ? <p className="notice">To konto nie prowadzi jeszcze lokalu. Swoje zapytania są na <Link href="/konto">koncie</Link>. <Link href="/rejestracja">Włącz rolę właściciela</Link>, jeśli chcesz dodać lokal.</p> : null}
        {venues && !venues.ok ? <p className="notice bad">{venues.detail}</p> : null}
        {venues?.ok ? (
          <table className="plain">
            <thead><tr><th>Nazwa</th><th>Miasto</th><th>Status</th></tr></thead>
            <tbody>
              {venues.data.length === 0 ? <tr><td colSpan={3}>Nie masz jeszcze lokalu. Szkic nie pojawia się w wyszukiwarce.</td></tr> : null}
              {venues.data.map((venue) => (
                <tr key={venue.id}>
                  <td><Link href={`/panel/${venue.id}`}>{internalVenueTitle(venue.nazwa)}</Link>{venue.przyklad ? " · przykład" : ""}</td>
                  <td>{venue.miasto}</td>
                  <td>{statusLabel(venue.status, venue.statusZgloszenia, venue.dirty)} · <Link href={`/panel/${venue.id}/zapytania`}>Zapytania</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {session.profile && session.profile.rola !== "klient" ? (
          <form className="form-card fields" action={createVenue} style={{ marginTop: 24 }}>
            <h2 className="wide">Dodaj kolejny lokal</h2>
            <p className="help wide">Powstaje osobny szkic. Zapis w edycji uzupełnia ten sam wiersz i go nie publikuje.</p>
            <label>Nazwa<input name="nazwa" /></label>
            <label>Miasto<input name="miasto" defaultValue="Zielona Góra" /></label>
            <div className="wide"><button className="btn" type="submit">Utwórz szkic</button></div>
          </form>
        ) : null}
      </main>
    </Shell>
  );
}
