import Link from "next/link";
import { Header } from "../components/chrome";
import { listOccasions, searchVenues } from "../data/supabase/catalog";
import { loadSession } from "../data/supabase/session";
import { readPublicEnv, setupMessage } from "../data/setup";
import { VenueGrid } from "../components/venue-grid";

export default async function HomePage() {
  const session = await loadSession();
  const env = readPublicEnv();
  const occasions = env.ok ? await listOccasions() : null;
  const venues = env.ok ? await searchVenues({
    miasto: "Zielona Góra",
    pojemnosc: null,
    okazja: "",
    cenaMaxGrosze: null,
    udogodnienie: "",
    sort: "cena",
  }) : null;

  return (
    <>
      <header className="hero">
        <div className="hero-bg"><img src="/img/hero.webp" alt="" /></div>
        <Header profile={session.profile} sharePath="/" />
        <div className="wrap hero-in">
          <h1 className="disp">Sala na każdą rodzinną okazję</h1>
          <p className="lead">Urodziny, komunie i przyjęcia. Najpierw w Zielonej Górze, a wyszukiwarka przyjmuje też inne miasta.</p>
          <form className="classic open" action="/sale" method="get" role="search">
            <label>
              <span>Okazja</span>
              <select name="okazja" defaultValue="">
                <option value="">Dowolna</option>
                {occasions?.ok ? occasions.data.map((item) => (
                  <option key={item.kod} value={item.kod}>{item.nazwa}</option>
                )) : null}
              </select>
            </label>
            <label>
              <span>Gdzie</span>
              <input name="miasto" defaultValue="Zielona Góra" aria-label="Miasto" />
            </label>
            <label>
              <span>Goście</span>
              <input name="goscie" inputMode="numeric" placeholder="Ile osób?" />
            </label>
            <label>
              <span>Cena do</span>
              <input name="cena" inputMode="decimal" placeholder="zł" />
            </label>
            <button className="btn" type="submit">Szukaj sal</button>
          </form>
          <p className="ai-hint">Wyczyść miasto, żeby szukać w całej Polsce. Opisowe wyszukiwanie i wolne terminy pojawią się, gdy będą prawdziwe dane — nie pokazujemy ich na zapas.</p>
          <div className="trust"><span>Lokal widać po weryfikacji</span><span>Szkic zostaje prywatny</span><span>Cena może być na zapytanie</span></div>
        </div>
        <span className="ex">ZDJĘCIE PRZYKŁADOWE</span>
      </header>
      <main>
        <section className="cats">
          <div className="wrap">
            <div className="sec-head"><h2 className="disp">Na jaką okazję?</h2><Link href="/sale">Wszystkie lokale</Link></div>
            <div className="tiles">
              {occasions?.ok ? occasions.data.map((item) => (
                <Link key={item.kod} className="tile" href={`/sale?okazja=${encodeURIComponent(item.kod)}&miasto=Zielona+Góra`}>
                  {item.zdjecie ? <img src={item.zdjecie} alt="" /> : <span className="empty-photo">Brak zdjęcia kafla</span>}
                  {item.zdjecie ? <span className="ex">ZDJĘCIE PRZYKŁADOWE</span> : null}
                  <span className="t">{item.nazwa_kafla}</span>
                </Link>
              )) : (
                <p className="notice bad">{env.ok ? "Nie udało się odczytać okazji." : setupMessage(env.missing)}</p>
              )}
            </div>
          </div>
        </section>
        <section className="venues">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="disp">Opublikowane lokale</h2>
              <Link href="/sale">Zobacz bez filtra miasta</Link>
            </div>
            <p className="help">Lista pokazuje lokale zaakceptowane przez administratora w Zielonej Górze. To nie jest kalendarz wolnych terminów.</p>
            {venues?.ok ? <VenueGrid hits={venues.data} /> : <p className="notice bad">{venues?.detail ?? "Brak danych."}</p>}
          </div>
        </section>
        <section className="how">
          <div className="wrap">
            <h2 className="disp">Jak to działa</h2>
            <div className="steps">
              <div className="step"><span className="caps">01</span><h3>Szukasz po mieście, gościach, okazji i cenie</h3><p>Widzisz tylko lokale, które administrator już opublikował.</p></div>
              <div className="step"><span className="caps">02</span><h3>Właściciel opisuje lokal</h3><p>Sale, zdjęcia, udogodnienia i cena — albo cena na zapytanie. Szkic nie jest publiczny.</p></div>
              <div className="step"><span className="caps">03</span><h3>Administrator publikuje</h3><p>Dopiero akceptacja pokazuje lokal gościom. Późniejsza edycja czeka na kolejne sprawdzenie.</p></div>
            </div>
          </div>
        </section>
        <section className="host" id="dla-wlascicieli">
          <div className="wrap">
            <div className="host-card">
              <div className="host-copy">
                <span className="caps">Dla właścicieli sal</span>
                <h2 className="disp">Masz salę? Dodaj ją.</h2>
                <p>Konto, opis, zdjęcia i cena. Wysyłasz lokal do sprawdzenia. Rezerwacje i płatności nie są jeszcze włączone.</p>
                <Link className="btn" href="/rejestracja">Dodaj swój lokal</Link>
              </div>
              <div className="host-photo"><img src="/img/sala-dworek.webp" alt="" /><span className="ex">ZDJĘCIE PRZYKŁADOWE</span></div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
