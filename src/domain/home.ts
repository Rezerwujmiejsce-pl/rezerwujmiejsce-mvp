export const HOME_DEFAULTS = {
  naglowek: "Sala na każdą rodzinną okazję",
  podtytul:
    "Urodziny, komunie i przyjęcia. Najpierw w Zielonej Górze, a wyszukiwarka przyjmuje też inne miasta.",
  baner: "/img/hero.webp",
} as const;

export const HOME_BANNERS = ["/img/hero.webp", "/img/hero-800.jpg", "/img/sala-dworek.webp"] as const;

export type HomeBanner = (typeof HOME_BANNERS)[number];

export type HomeTileSetting = {
  kod: string;
  kolejnosc: number;
  widoczna: boolean;
};

export type HomePublication = {
  naglowek: string;
  podtytul: string;
  baner: string;
  kafle: HomeTileSetting[];
};

export type CatalogTile = {
  kod: string;
  nazwa: string;
  nazwa_kafla: string;
  zdjecie: string | null;
  kolejnosc: number;
};

export function homeProblems(input: { naglowek: string; podtytul: string; baner: string }): string[] {
  const problems: string[] = [];
  const naglowek = input.naglowek.trim();
  const podtytul = input.podtytul.trim();
  if (naglowek.length < 2 || naglowek.length > 120) problems.push("Nagłówek ma mieć 2–120 znaków.");
  if (podtytul.length < 2 || podtytul.length > 400) problems.push("Podtytuł ma mieć 2–400 znaków.");
  if (/[<>]/.test(naglowek) || /[<>]/.test(podtytul)) problems.push("Tekst strony nie może zawierać znaczników HTML.");
  if (!HOME_BANNERS.includes(input.baner as HomeBanner)) {
    problems.push("Baner wybierz z plików strony. Adres z internetu nie jest dozwolony.");
  }
  return problems;
}

export function publicHome(
  published: HomePublication | null,
  catalog: CatalogTile[],
): { naglowek: string; podtytul: string; baner: string; kafle: CatalogTile[] } {
  const copy = published
    ? { naglowek: published.naglowek, podtytul: published.podtytul, baner: published.baner }
    : HOME_DEFAULTS;
  const byCode = new Map((published?.kafle ?? []).map((tile) => [tile.kod, tile]));
  const kafle = catalog
    .filter((tile) => {
      const setting = byCode.get(tile.kod);
      return setting ? setting.widoczna : true;
    })
    .sort((a, b) => {
      const left = byCode.get(a.kod)?.kolejnosc ?? 1000 + a.kolejnosc;
      const right = byCode.get(b.kod)?.kolejnosc ?? 1000 + b.kolejnosc;
      return left - right || a.kod.localeCompare(b.kod);
    });
  return { ...copy, kafle };
}
