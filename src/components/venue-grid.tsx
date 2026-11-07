import Link from "next/link";
import type { SearchHit } from "../data/supabase/catalog";

export function VenueGrid({ hits, className = "grid" }: { hits: SearchHit[]; className?: string }) {
  if (!hits.length) {
    return (
      <div className="empty">
        <h3>Brak lokali dla tych filtrów</h3>
        <p>Zmień miasto, liczbę gości albo cenę. Pusta lista znaczy, że w bazie nie ma pasującej publikacji — nie dokładamy przykładowych sal.</p>
      </div>
    );
  }
  return (
    <div className={className}>
      {hits.map((hit) => (
        <article className="card" key={hit.id}>
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
          </div>
        </article>
      ))}
    </div>
  );
}
