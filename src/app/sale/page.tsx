import Link from "next/link";
import { ResultsBrowser } from "../../components/results-browser";
import { Shell } from "../../components/shell";
import { parsePositiveInt, zlotyToGrosze } from "../../domain/rules";
import { listAmenities, listOccasions, searchVenues, type SearchFilters } from "../../data/supabase/catalog";
import { readPublicEnv, setupMessage } from "../../data/setup";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const filters: SearchFilters = {
    miasto: pick("miasto"),
    pojemnosc: parsePositiveInt(pick("goscie")),
    okazja: pick("okazja"),
    cenaMaxGrosze: pick("cena") ? zlotyToGrosze(pick("cena")) : null,
    udogodnienie: pick("udogodnienie"),
    sort: pick("sort") === "pojemnosc" ? "pojemnosc" : "cena",
  };
  const badPrice = Boolean(pick("cena")) && filters.cenaMaxGrosze == null;
  const env = readPublicEnv();
  const [occasions, amenities, results] = env.ok
    ? await Promise.all([listOccasions(), listAmenities(), badPrice ? Promise.resolve(null) : searchVenues(filters)])
    : [null, null, null];

  const query = new URLSearchParams();
  if (filters.miasto) query.set("miasto", filters.miasto);
  if (filters.okazja) query.set("okazja", filters.okazja);
  if (pick("goscie")) query.set("goscie", pick("goscie"));
  if (pick("cena")) query.set("cena", pick("cena"));

  return (
    <Shell sharePath={`/sale?${query.toString()}`}>
      <div className="fbar">
        <form className="wrap" action="/sale" method="get">
          <label className="fpill on noarr">Miasto <input name="miasto" defaultValue={filters.miasto} placeholder="cała Polska" /></label>
          <label className="fpill noarr">Goście <input name="goscie" defaultValue={pick("goscie")} inputMode="numeric" /></label>
          <label className="fpill">
            Okazja
            <select name="okazja" defaultValue={filters.okazja}>
              <option value="">Dowolna</option>
              {occasions?.ok ? occasions.data.map((item) => <option key={item.kod} value={item.kod}>{item.nazwa}</option>) : null}
            </select>
          </label>
          <label className="fpill noarr">Cena do, zł <input name="cena" defaultValue={pick("cena")} inputMode="decimal" /></label>
          <label className="fpill">
            Sortuj
            <select name="sort" defaultValue={filters.sort}>
              <option value="cena">Cena</option>
              <option value="pojemnosc">Pojemność</option>
            </select>
          </label>
          <button className="btn sm" type="submit">Szukaj</button>
          {amenities?.ok ? amenities.data.map((item) => (
            <Link
              key={item.kod}
              className={filters.udogodnienie === item.kod ? "fpill on" : "fpill"}
              href={`/sale?${new URLSearchParams({ ...Object.fromEntries(query), udogodnienie: filters.udogodnienie === item.kod ? "" : item.kod }).toString()}`}
            >
              {item.nazwa}
            </Link>
          )) : null}
          {filters.udogodnienie ? <input type="hidden" name="udogodnienie" value={filters.udogodnienie} /> : null}
        </form>
      </div>
      <main>
        {!env.ok ? <p className="notice bad wrap">{setupMessage(env.missing)}</p> : null}
        {badPrice ? <p className="notice bad wrap">Cena „do” musi być kwotą w złotych, na przykład 2400 albo 2400,50.</p> : null}
        {results && !results.ok ? <p className="notice bad wrap">{results.detail}</p> : null}
        {results?.ok ? (
          <ResultsBrowser
            hits={results.data}
            place={filters.miasto ? filters.miasto : "Cała Polska"}
          />
        ) : (
          <div className="res nomap">
            <div className="res-head"><h1>Lokale</h1></div>
          </div>
        )}
      </main>
    </Shell>
  );
}
