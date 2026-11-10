import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "../../../../components/shell";
import { publicAvailability } from "../../../../data/supabase/calendar";
import { getPublishedVenue } from "../../../../data/supabase/catalog";
import { readPublicEnv, setupMessage } from "../../../../data/setup";

export default async function VenuePage({
  params,
}: {
  params: Promise<{ miasto: string; slug: string }>;
}) {
  const { miasto, slug } = await params;
  const env = readPublicEnv();
  if (!env.ok) {
    return (
      <Shell sharePath={`/sale/${miasto}/${slug}`}>
        <main className="page"><div className="wrap page-pad"><p className="notice bad">{setupMessage(env.missing)}</p></div></main>
      </Shell>
    );
  }
  const result = await getPublishedVenue(decodeURIComponent(miasto), decodeURIComponent(slug));
  if (!result.ok) {
    return (
      <Shell sharePath={`/sale/${miasto}/${slug}`}>
        <main className="page"><div className="wrap page-pad"><p className="notice bad">{result.detail}</p></div></main>
      </Shell>
    );
  }
  if (!result.data) notFound();
  const venue = result.data;
  const warsawToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [startYear, startMonth, startDay] = warsawToday.split("-").map(Number);
  const stripEnd = new Date(Date.UTC(startYear, startMonth - 1, startDay + 13)).toISOString().slice(0, 10);
  const strip = await publicAvailability(venue.id, warsawToday, stripEnd);
  const place = [venue.dzielnica, venue.miasto].filter(Boolean).join(" · ");
  const mapHref = venue.lat != null && venue.lng != null
    ? `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=16/${venue.lat}/${venue.lng}`
    : null;

  return (
    <Shell sharePath={`/sale/${miasto}/${slug}`}>
      <main className="page">
        <div className="wrap">
          <p className="crumbs"><Link href="/sale">Sale</Link> › <Link href={`/sale?miasto=${encodeURIComponent(venue.miasto)}`}>{venue.miasto}</Link> › {venue.nazwa}</p>
          <div className="vhead">
            <h1>{venue.nazwa}</h1>
            {venue.przyklad ? <span className="demo-note">Dane przykładowe, nie lokal z produkcji</span> : null}
          </div>
          <p className="vsub">{place}{venue.pojemnosc ? ` · do ${venue.pojemnosc} osób` : ""}{venue.sale.length ? ` · ${venue.sale.length} ${venue.sale.length === 1 ? "sala" : "sale"}` : ""}</p>
          <div className="gal">
            {venue.zdjecia.length ? venue.zdjecia.slice(0, 5).map((photo) => (
              <img key={photo.id} src={photo.sciezka} alt={photo.podpis ?? ""} />
            )) : <div className="empty-photo">Ten lokal nie dodał jeszcze zdjęcia.</div>}
          </div>
          <div className="vcols">
            <div>
              <section>
                <h2 className="st">O lokalu</h2>
                <p>{venue.opis || "Właściciel nie dodał opisu."}</p>
                <div className="feats">
                  {venue.udogodnienia.map((item) => (
                    <span key={item.kod}>{item.nazwa}{item.szczegol ? ` · ${item.szczegol}` : ""}</span>
                  ))}
                  {venue.okazje.map((item) => <span key={item.kod}>{item.nazwa}</span>)}
                </div>
              </section>
              <section>
                <h2 className="st">{venue.jedenObiekt ? "Przestrzeń" : "Sale"}</h2>
                <div className="pkgs">
                  {venue.sale.map((room) => (
                    <div className="box" key={room.id}>
                      <h3>{room.nazwa}</h3>
                      <p><b>{room.cena}</b></p>
                      <p>do {room.pojemnosc} {room.jednostka}{room.metraz ? ` · ${room.metraz} m²` : ""}</p>
                      {room.opis ? <p>{room.opis}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h2 className="st">Lokalizacja</h2>
                <p>{[venue.adres, venue.kod, venue.miasto].filter(Boolean).join(", ") || "Adres nie został podany."}</p>
                {mapHref ? <p><a href={mapHref} target="_blank" rel="noopener noreferrer">Otwórz w OpenStreetMap</a></p> : <p className="help">Brak współrzędnych, więc nie ma pinezki.</p>}
              </section>
              <section>
                <h2 className="st">Zasady i godziny</h2>
                {venue.godziny ? <p>Godziny: {venue.godziny}</p> : <p className="help">Godziny nie zostały podane.</p>}
                {venue.zasady.length ? (
                  <ul>{venue.zasady.map((rule) => <li key={rule}>{rule}</li>)}</ul>
                ) : <p className="help">Właściciel nie wpisał zasad.</p>}
                {strip.ok && strip.data.length > 0 ? (
                  <>
                    <h3>Wolne terminy</h3>
                    <p className="help">Najbliższe dwa tygodnie. „Zajęte” znaczy, że każda opublikowana sala ma tego dnia blokadę albo zapytanie. Jedna wolna sala zostawia dzień jako „Wolne”. Nie ma tu nazwisk, numerów zapytań ani pełnego kalendarza. Zapytanie nie jest opłaconą rezerwacją.</p>
                    <ul className="avail">
                      {strip.data.map((day) => (
                        <li key={day.dzien}>
                          <span>{day.dzien.slice(8)}.{day.dzien.slice(5, 7)}</span>
                          <b>{day.stan === "wolne" ? "Wolne" : day.stan === "zajete" ? "Zajęte" : "Wstrzymane"}</b>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="help">Pasek wolnych terminów nie jest jeszcze dostępny. Zapytanie nie jest opłaconą rezerwacją.</p>
                )}
              </section>
            </div>
            <aside>
              <div className="box book">
                <div className="pr">{venue.cena}</div>
                <p>To cena z opublikowanego cennika. Rezerwacji i zadatku jeszcze nie ma.</p>
                {venue.wstrzymane ? (
                  <p className="notice">Właściciel wstrzymał przyjmowanie rezerwacji. Strona zostaje widoczna. Nowego zapytania nie zapisujemy. To nie jest zawieszenie przez administratora.</p>
                ) : (
                  <Link className="btn" href={`/sale/${miasto}/${slug}/zapytanie`}>Zapytaj o termin</Link>
                )}
                {venue.telefon ? <a className="btn ghost" href={`tel:${venue.telefon}`}>Zadzwoń: {venue.telefon}</a> : <p className="help">Brak publicznego telefonu.</p>}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </Shell>
  );
}
