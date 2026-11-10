"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { mapPoints, pointsInBounds, type MapBounds } from "../domain/map-points";
import type { SearchHit } from "../data/supabase/catalog";
import { VenueGrid } from "./venue-grid";

const ResultMap = dynamic(() => import("./result-map").then((mod) => mod.ResultMap), {
  ssr: false,
  loading: () => <p className="map-note">Ładowanie mapy…</p>,
});

export function ResultsBrowser({
  hits,
  place,
}: {
  hits: SearchHit[];
  place: string;
}) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [mapOn, setMapOn] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const located = mapPoints(hits);
  const visiblePoints = bounds ? pointsInBounds(located, bounds) : located;
  const visibleHits = bounds ? hits.filter((hit) => visiblePoints.some((point) => point.id === hit.id)) : hits;
  const missing = hits.length - located.length;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 960px)");
    setNarrow(query.matches);
    setMapOn(!query.matches);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`wynik-${selectedId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const showMap = mapOn === true;
  const frame = `res${showMap ? (narrow ? " showmap" : "") : " nomap"}`;

  return (
    <div className={frame}>
      <div>
        <div className="res-head">
          <div>
            <h1>{visibleHits.length} {visibleHits.length === 1 ? "lokal" : "lokali"}</h1>
            <p className="small muted">{place} · bez kalendarza wolnych terminów</p>
          </div>
          <div className="res-tools">
            <button type="button" className="tbtn" onClick={() => setMapOn((value) => !value)} aria-pressed={showMap}>
              {showMap ? "Ukryj mapę" : "Pokaż mapę"}
            </button>
            <div className="seg" role="group" aria-label="Układ wyników">
              <button type="button" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}>Siatka</button>
              <button type="button" aria-pressed={layout === "list"} onClick={() => setLayout("list")}>Lista</button>
            </div>
            {bounds ? (
              <button type="button" className="tbtn" onClick={() => setBounds(null)}>Pokaż cały wynik</button>
            ) : null}
          </div>
        </div>
        {missing > 0 ? (
          <p className="help">Nie każdy lokal z tej listy ma obie współrzędne. Bez nich nie ma pinezki i nie podstawiamy środka miasta.</p>
        ) : null}
        <VenueGrid
          hits={visibleHits}
          className="rgrid"
          layout={layout}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <aside className="map" aria-label="Mapa opublikowanych lokali ze współrzędnymi">
        {located.length === 0 ? (
          <div className="map-note">
            <strong>Brak pinezek</strong>
            <p>Żaden lokal w tych wynikach nie ma obu współrzędnych. Mapa ilustracyjna z makiety nie jest podkładem i nie dostaje przykładowych cen.</p>
          </div>
        ) : showMap ? (
          <ResultMap
            points={visiblePoints}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSearchArea={setBounds}
          />
        ) : (
          <p className="map-note">Mapa jest ukryta. Przycisk „Pokaż mapę” wczyta podkład dopiero wtedy.</p>
        )}
      </aside>
      <button
        type="button"
        className="mapfab"
        onClick={() => setMapOn((value) => !value)}
        aria-pressed={showMap}
      >
        {showMap ? "Lista" : "Mapa"}
      </button>
    </div>
  );
}
