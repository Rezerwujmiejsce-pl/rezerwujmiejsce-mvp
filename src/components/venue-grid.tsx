"use client";

import Link from "next/link";
import type { SearchHit } from "../data/supabase/catalog";

export function VenueGrid({
  hits,
  className = "grid",
  layout = "grid",
  selectedId,
  onSelect,
}: {
  hits: SearchHit[];
  className?: string;
  layout?: "grid" | "list";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (!hits.length) {
    return (
      <div className="empty">
        <h3>Brak lokali dla tych filtrów</h3>
        <p>Zmień miasto, liczbę gości albo cenę. Pusta lista znaczy, że w bazie nie ma pasującej publikacji — nie dokładamy przykładowych sal.</p>
      </div>
    );
  }
  if (layout === "list") {
    return (
      <div className="rlist">
        {hits.map((hit) => (
          <article
            key={hit.id}
            id={`wynik-${hit.id}`}
            className={hit.id === selectedId ? "lcard hl" : "lcard"}
            onMouseEnter={() => onSelect?.(hit.id)}
            onFocus={() => onSelect?.(hit.id)}
          >
            <div className="photo">
              {hit.photo ? <img alt="" src={hit.photo} /> : <span className="empty-photo">Brak zdjęcia</span>}
              {hit.przyklad ? <span className="ex">DANE PRZYKŁADOWE</span> : null}
            </div>
            <div>
              <h3>{hit.nazwa}</h3>
              <p>{[hit.dzielnica, hit.miasto].filter(Boolean).join(" · ")} · {hit.typ}</p>
              <p>{hit.pojemnosc ? `do ${hit.pojemnosc} osób` : "pojemność niepodana"}</p>
            </div>
            <div className="side">
              <span className="p">{hit.cena}</span>
              <Link href={hit.href}>Strona lokalu</Link>
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className={className}>
      {hits.map((hit) => (
        <article
          key={hit.id}
          id={`wynik-${hit.id}`}
          className={hit.id === selectedId ? "card hl" : "card"}
          onMouseEnter={() => onSelect?.(hit.id)}
          onFocus={() => onSelect?.(hit.id)}
        >
          <div className="photo">
            {hit.photo ? (
              <img className="p" alt="" src={hit.photo} />
            ) : (
              <span className="empty-photo">Brak zdjęcia</span>
            )}
            {hit.przyklad ? <span className="ex">DANE PRZYKŁADOWE</span> : null}
          </div>
          <Link className="cover" href={hit.href} aria-label={hit.nazwa} />
          <div className="info">
            <h3>{hit.nazwa}</h3>
            <p className="loc">{[hit.dzielnica, hit.miasto].filter(Boolean).join(" · ")} · {hit.typ}</p>
            <p className="meta"><b>{hit.pojemnosc ? `do ${hit.pojemnosc} osób` : "pojemność niepodana"}</b>{hit.liczbaSal ? ` · ${hit.liczbaSal} ${hit.liczbaSal === 1 ? "sala" : "sale"}` : ""}</p>
            <p className="price">{hit.cena}</p>
            {hit.wstrzymane ? <p className="help">Rezerwacje wstrzymane. Strona lokalu jest dostępna.</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
