export type MapHit = {
  id: string;
  lat: number | null;
  lng: number | null;
  cena: string;
  href: string;
  nazwa: string;
};

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  href: string;
  nazwa: string;
  label: string;
  priced: boolean;
};

export type MapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export function parseCoordinatePair(latRaw: string, lngRaw: string): { lat: number | null; lng: number | null } {
  const latEmpty = latRaw.trim() === "";
  const lngEmpty = lngRaw.trim() === "";
  if (latEmpty && lngEmpty) return { lat: null, lng: null };
  if (latEmpty || lngEmpty) {
    throw new Error("Podaj obie współrzędne albo zostaw obie puste. Pinezki nie ustawiamy ze środka miasta.");
  }
  const lat = Number(latRaw.trim().replace(",", "."));
  const lng = Number(lngRaw.trim().replace(",", "."));
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error("Szerokość od −90 do 90, długość od −180 do 180.");
  }
  return { lat, lng };
}

/** Ta sama linia co na karcie: „od” zostaje z jednostką (za osobę, za salę, za godzinę). */
export function markerLabel(cena: string): { text: string; priced: boolean } {
  if (cena === "cena na zapytanie" || cena.trim() === "") return { text: "na zapytanie", priced: false };
  return { text: cena, priced: true };
}

function usable(lat: number | null, lng: number | null): lat is number {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Pinezki wyłącznie z podanych wyników. Brak współrzędnych nie dostaje środka miasta. */
export function mapPoints(hits: MapHit[]): MapPoint[] {
  const points: MapPoint[] = [];
  for (const hit of hits) {
    if (!usable(hit.lat, hit.lng) || hit.lng == null) continue;
    const label = markerLabel(hit.cena);
    points.push({
      id: hit.id,
      lat: hit.lat,
      lng: hit.lng,
      href: hit.href,
      nazwa: hit.nazwa,
      label: label.text,
      priced: label.priced,
    });
  }
  return points;
}

export function pointsInBounds(points: MapPoint[], bounds: MapBounds): MapPoint[] {
  if (bounds.south > bounds.north || bounds.west > bounds.east) return [];
  return points.filter(
    (point) =>
      point.lat >= bounds.south &&
      point.lat <= bounds.north &&
      point.lng >= bounds.west &&
      point.lng <= bounds.east,
  );
}
