export type MediaCacheHeaders = {
  "Cache-Control": string;
  Vary: string;
  Pragma: string;
  "CDN-Cache-Control": string;
};

/**
 * Szkic i zdjęcie tuż po wycofaniu publikacji nie mogą zostać w współdzielonym cache.
 * Opublikowany plik też dostaje no-store: po ukryciu lokalu albo kolejnej akceptacji
 * ten sam adres przestaje być publiczny, a cache z max-age zostałby ze starymi bajtami.
 */
export function mediaCacheHeaders(published: boolean): MediaCacheHeaders {
  // published jest w sygnaturze, żeby test pilnował obu przypadków.
  // Żaden nie dostaje public ani max-age: po ukryciu lokalu adres przestaje być publiczny.
  void published;
  return {
    "Cache-Control": "private, no-store",
    Vary: "Cookie",
    Pragma: "no-cache",
    "CDN-Cache-Control": "no-store",
  };
}
