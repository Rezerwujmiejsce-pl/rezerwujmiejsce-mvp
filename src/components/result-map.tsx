"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { MapBounds, MapPoint } from "../domain/map-points";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function ResultMap({
  points,
  selectedId,
  onSelect,
  onSearchArea,
}: {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchArea: (bounds: MapBounds) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const fitted = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onAreaRef = useRef(onSearchArea);
  const [failed, setFailed] = useState(false);
  onSelectRef.current = onSelect;
  onAreaRef.current = onSearchArea;

  useEffect(() => {
    const node = container.current;
    if (!node || mapRef.current) return;
    const map = new maplibregl.Map({
      container: node,
      style: STYLE,
      attributionControl: { compact: false },
      fadeDuration: 0,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let styleReady = false;
    map.on("style.load", () => {
      styleReady = true;
    });
    map.on("error", () => {
      if (!styleReady) setFailed(true);
    });
    mapRef.current = map;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.remove();
      mapRef.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current.clear();
    for (const point of points) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pin";
      button.textContent = point.label;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${point.nazwa}, ${point.label}. Zaznacza kartę na liście.`);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectRef.current(point.id);
      });
      const marker = new maplibregl.Marker({ element: button, anchor: "center" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      markers.current.set(point.id, marker);
    }
    if (!fitted.current && points.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const point of points) bounds.extend([point.lng, point.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
      fitted.current = true;
    }
  }, [points]);

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const button = marker.getElement();
      const on = id === selectedId;
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }, [selectedId, points]);

  function searchHere() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    onAreaRef.current({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    });
  }

  return (
    <>
      <div ref={container} className="map-canvas" />
      <button type="button" className="here" onClick={searchHere}>Szukaj w tym obszarze</button>
      {failed ? (
        <p className="mnote" role="status">Nie udało się wczytać podkładu. Lista zostaje. Pinezek nie zmyślamy.</p>
      ) : null}
    </>
  );
}
