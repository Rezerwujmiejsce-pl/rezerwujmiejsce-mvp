import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "../../../../../components/chrome";
import { InquirySteps } from "../../../../../components/inquiry-steps";
import { Shell } from "../../../../../components/shell";
import { estimateNote } from "../../../../../domain/inquiry";
import { getPublishedVenue } from "../../../../../data/supabase/catalog";
import { loadSession } from "../../../../../data/supabase/session";
import { readPublicEnv, setupMessage } from "../../../../../data/setup";
import { sendInquiry } from "./actions";

export default async function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ miasto: string; slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { miasto, slug } = await params;
  const query = await searchParams;
  const path = `/sale/${miasto}/${slug}/zapytanie`;
  const env = readPublicEnv();
  if (!env.ok) {
    return (
      <Shell sharePath={path}>
        <main className="page"><div className="wrap page-pad"><h1 className="disp">Zapytaj o termin</h1><p className="notice bad">{setupMessage(env.missing)}</p></div></main>
      </Shell>
    );
  }
  const result = await getPublishedVenue(decodeURIComponent(miasto), decodeURIComponent(slug));
  if (!result.ok) {
    return (
      <Shell sharePath={path}>
        <main className="page"><div className="wrap page-pad"><p className="notice bad">{result.detail}</p></div></main>
      </Shell>
    );
  }
  if (!result.data) notFound();
  const venue = result.data;
  const session = await loadSession();
  const photo = venue.zdjecia[0]?.sciezka ?? null;
  const capacities = venue.sale.map((room) => `${room.id}:${room.pojemnosc}`).join(",");
  return (
    <Shell sharePath={path}>
      <main className="page">
        <div className="wrap">
          <p className="crumbs">
            <Link href={`/sale/${miasto}/${slug}`}>{venue.nazwa}</Link> › Zapytaj o termin
          </p>
          <h1 className="disp">Zapytaj o termin</h1>
          <InquirySteps stage="form" />
          <Flash blad={query.blad} />
          {venue.sale.length === 0 ? (
            <p className="notice">Ten lokal nie ma opublikowanej sali, więc nie da się wysłać zapytania.</p>
          ) : (
            <div className="rz">
              <form className="fgrid" action={sendInquiry}>
                <input type="hidden" name="lokal" value={venue.id} />
                <input type="hidden" name="powrot" value={path} />
                <input type="hidden" name="pojemnosci" value={capacities} />
                <label className="fld">
                  Sala
                  <select name="sala" required defaultValue={venue.sale[0]?.id}>
                    {venue.sale.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.nazwa} · do {room.pojemnosc} {room.jednostka} · {room.cena}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fld">
                  Okazja
                  <select name="okazja" defaultValue="">
                    <option value="">Nie wybieram</option>
                    {venue.okazje.map((item) => (
                      <option key={item.kod} value={item.kod}>{item.nazwa}</option>
                    ))}
                  </select>
                </label>
                <label className="fld">
                  Data
                  <input name="data" type="date" required />
                </label>
                <label className="fld">
                  Godzina
                  <input name="godzina" type="time" required />
                </label>
                <label className="fld">
                  Liczba gości
                  <input name="goscie" type="number" min={1} max={5000} required inputMode="numeric" />
                </label>
                <label className="fld">
                  Imię i nazwisko
                  <input name="imie" required autoComplete="name" defaultValue={session.profile?.imie_nazwisko ?? ""} />
                </label>
                <label className="fld">
                  Telefon
                  <input name="telefon" required autoComplete="tel" defaultValue={session.profile?.telefon ?? ""} />
                </label>
                <label className="fld">
                  E-mail
                  <input name="email" type="email" required autoComplete="email" defaultValue={session.profile?.email ?? ""} />
                </label>
                <label className="fld full">
                  Wiadomość
                  <textarea name="wiadomosc" maxLength={2000} />
                </label>
                <div className="full">
                  <button className="btn" type="submit">Wyślij zapytanie</button>
                  <p className="help">
                    Zapisujemy zapytanie w portalu lokalu. Nie wysyłamy SMS-a ani e-maila. To nie jest rezerwacja i nie ma zadatku.
                    {session.profile
                      ? " Jesteś zalogowany, więc to zapytanie pojawi się na koncie."
                      : " Bez logowania nie zobaczysz go później na koncie. Nie dopisujemy starych zapytań po e-mailu ani telefonie."}
                  </p>
                </div>
              </form>
              <aside className="box sum">
                <div className="v">
                  {photo ? <img src={photo} alt="" /> : <div className="ph" aria-hidden="true" />}
                  <div>
                    <b>{venue.nazwa}</b>
                    <p>{venue.miasto}</p>
                  </div>
                </div>
                <p>{venue.cena}</p>
                <p>{estimateNote(null)} Kwotę, którą da się policzyć z wybranej sali, zapisze serwer.</p>
                {venue.przyklad ? <p className="demo-note">Dane przykładowe, nie lokal z produkcji</p> : null}
              </aside>
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
