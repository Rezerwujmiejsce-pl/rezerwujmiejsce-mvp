import assert from "node:assert/strict";
import test from "node:test";
import { loadPublicHome } from "../src/data/home-load";
import { HOME_DEFAULTS, homeProblems, publicHome } from "../src/domain/home";
import { estimateFromRoom, inquiryProblems, inquirySuccessCopy, inquirySuccessPath, shortAccountLabel } from "../src/domain/inquiry";
import { mapPoints, markerLabel, parseCoordinatePair, pointsInBounds } from "../src/domain/map-points";
import { mediaCacheHeaders } from "../src/domain/media-cache";
import {
  formatZloty,
  groszeToInput,
  parsePositiveInt,
  priceLine,
  safeNextPath,
  sniffImage,
  statusLabel,
  submitBlockers,
  zlotyToGrosze,
} from "../src/domain/rules";

test("kwoty w groszach bez progu kompletności", () => {
  assert.equal(zlotyToGrosze("2400"), 240000);
  assert.equal(zlotyToGrosze("2 400,50"), 240050);
  assert.equal(zlotyToGrosze(""), null);
  assert.equal(zlotyToGrosze("12.345"), null);
  assert.match(formatZloty(240000), /2\s?400 zł/);
  assert.equal(groszeToInput(240050), "2400,50");
  assert.match(priceLine(null, "za_sale", true), /zapytanie/);
  assert.match(priceLine(10000, "za_osobe", false), /za osobę/);
});

test("wysłanie wymaga sali i ceny, nie zdjęć", () => {
  const errors = submitBlockers({
    nazwa: "A",
    miasto: "",
    rooms: [{ nazwa: "", widoczna: true, pojemnosc: null, cenaUstalona: false }],
  });
  assert.equal(errors.some((item) => /zdję/i.test(item)), false);
  assert.equal(errors.some((item) => /80|komplet/i.test(item)), false);
  assert.ok(errors.length >= 2);
  assert.deepEqual(
    submitBlockers({
      nazwa: "Sala",
      miasto: "Żary",
      rooms: [{ nazwa: "Cały lokal", widoczna: true, pojemnosc: 40, cenaUstalona: true }],
    }),
    [],
  );
});

test("status opublikowany nie udaje, że zmiany już weszły", () => {
  assert.match(statusLabel("published", "none", true), /niewysłane/);
  assert.match(statusLabel("published", "pending_review", false), /czekają/);
  assert.equal(statusLabel("draft", "none", false), "Szkic");
});

test("strona główna startuje sesję i katalog naraz", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const task = (value: string) => async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 30));
    inFlight -= 1;
    return value;
  };
  const started = performance.now();
  const result = await loadPublicHome({
    session: task("sesja"),
    occasions: task("okazje"),
    venues: task("lokale"),
    copy: task("tekst"),
  });
  const parallelMs = performance.now() - started;
  const sequentialStarted = performance.now();
  await task("sesja")();
  await task("okazje")();
  await task("lokale")();
  await task("tekst")();
  const sequentialMs = performance.now() - sequentialStarted;
  assert.equal(result.session, "sesja");
  assert.equal(result.copy, "tekst");
  assert.equal(maxInFlight, 4);
  assert.ok(
    parallelMs < sequentialMs,
    `równolegle ${parallelMs.toFixed(0)} ms nie było krótsze niż kolejno ${sequentialMs.toFixed(0)} ms`,
  );
});

test("cache zdjęć nie jest publiczny ani po publikacji, ani dla szkicu", () => {
  for (const published of [false, true]) {
    const headers = mediaCacheHeaders(published);
    assert.match(headers["Cache-Control"], /private/);
    assert.match(headers["Cache-Control"], /no-store/);
    assert.doesNotMatch(headers["Cache-Control"], /public/);
    assert.equal(headers.Vary, "Cookie");
    assert.equal(headers["CDN-Cache-Control"], "no-store");
  }
});

test("szacunek zapytania nie wymyśla pakietu ani zadatku", () => {
  assert.equal(estimateFromRoom({ unit: "za_osobe", grosze: 10000, onRequest: false, guests: 4 }), 40000);
  assert.equal(estimateFromRoom({ unit: "za_sale", grosze: 150000, onRequest: false, guests: 4 }), 150000);
  assert.equal(estimateFromRoom({ unit: "za_godzine", grosze: 10000, onRequest: false, guests: 4 }), null);
  assert.equal(estimateFromRoom({ unit: "za_pakiet", grosze: 640000, onRequest: false, guests: 40 }), null);
  assert.equal(estimateFromRoom({ unit: "za_osobe", grosze: 10000, onRequest: true, guests: 4 }), null);
  const problems = inquiryProblems({
    guests: 50,
    date: "2020-01-01",
    time: "14:00",
    name: "A",
    phone: "12",
    email: "zly",
    message: "",
    roomId: "nie-sala",
    today: "2026-11-10",
    roomCapacity: 40,
  });
  assert.ok(problems.some((item) => /gości/.test(item)));
  assert.ok(problems.some((item) => /18 miesięcy/.test(item)));
  assert.equal(shortAccountLabel("Jan Nowak", null), "Jan N.");
});

test("pinezki biorą tylko prawdziwe współrzędne i cenę z cennika", () => {
  assert.throws(() => parseCoordinatePair("51.9", ""), /obie/);
  assert.deepEqual(parseCoordinatePair("", ""), { lat: null, lng: null });
  assert.deepEqual(parseCoordinatePair("51,93", "15.50"), { lat: 51.93, lng: 15.5 });
  assert.throws(() => parseCoordinatePair("120", "15"), /90/);
  const perPerson = priceLine(10000, "za_osobe", false);
  const perVenue = priceLine(240000, "za_sale", false);
  const perHour = priceLine(10000, "za_godzine", false);
  const hits = [
    { id: "a", lat: 51.93, lng: 15.5, cena: perVenue, href: "/sale/a", nazwa: "A" },
    { id: "b", lat: null, lng: 15.5, cena: perPerson, href: "/sale/b", nazwa: "B" },
    { id: "c", lat: 52, lng: 16, cena: "cena na zapytanie", href: "/sale/c", nazwa: "C" },
    { id: "d", lat: 91, lng: 15, cena: perHour, href: "/sale/d", nazwa: "D" },
  ];
  const points = mapPoints(hits);
  assert.deepEqual(points.map((point) => point.id), ["a", "c"]);
  assert.equal(points[0]?.label, perVenue);
  assert.match(points[0]?.label ?? "", /za salę/);
  assert.match(perPerson, /za osobę/);
  assert.match(perHour, /za godzinę/);
  assert.equal(markerLabel(perHour).text, perHour);
  assert.equal(points[1]?.label, "na zapytanie");
  assert.equal(markerLabel("").text, "na zapytanie");
  const inside = pointsInBounds(points, { south: 51, west: 15, north: 52, east: 16 });
  assert.deepEqual(inside.map((point) => point.id), ["a", "c"]);
  assert.deepEqual(pointsInBounds(points, { south: 60, west: 15, north: 52, east: 16 }), []);
});

test("adres potwierdzenia nie ogłasza zapisu i nie niesie danych", () => {
  const path = inquirySuccessPath("/sale/zielona-gora/sala/zapytanie?zapis=1&email=a@b.c");
  assert.equal(path, "/sale/zielona-gora/sala/zapytanie/wyslane");
  assert.equal(path.includes("?"), false);
  assert.equal(path.includes("@"), false);
  const forged = inquirySuccessCopy(false, "Sala Testowa");
  assert.equal(forged.title.includes("jest w portalu"), false);
  assert.equal(forged.body.includes("Zapisaliśmy"), false);
  assert.equal(forged.body.includes("Sala Testowa"), false);
  const real = inquirySuccessCopy(true, "Sala Testowa");
  assert.match(real.body, /Zapisaliśmy zapytanie do lokalu Sala Testowa/);
  assert.match(real.body, /Nie wysłaliśmy SMS-a ani e-maila/);
});

test("szkic strony głównej nie zastępuje tekstu, dopóki nie ma publikacji", () => {
  const catalog = [
    { kod: "urodziny", nazwa: "Urodziny", nazwa_kafla: "Urodziny", zdjecie: "/img/kat-urodziny.webp", kolejnosc: 2 },
    { kod: "komunia", nazwa: "Komunia", nazwa_kafla: "Komunie", zdjecie: "/img/kat-komunie.webp", kolejnosc: 1 },
  ];
  const defaults = publicHome(null, catalog);
  assert.equal(defaults.naglowek, HOME_DEFAULTS.naglowek);
  assert.deepEqual(defaults.kafle.map((tile) => tile.kod), ["komunia", "urodziny"]);
  const published = publicHome({
    naglowek: "Inny nagłówek",
    podtytul: "Inny podtytuł strony głównej.",
    baner: "/img/hero-800.jpg",
    kafle: [
      { kod: "urodziny", kolejnosc: 1, widoczna: true },
      { kod: "komunia", kolejnosc: 2, widoczna: false },
    ],
  }, catalog);
  assert.equal(published.naglowek, "Inny nagłówek");
  assert.deepEqual(published.kafle.map((tile) => tile.kod), ["urodziny"]);
  assert.ok(homeProblems({ naglowek: "<script>alert(1)</script>", podtytul: "Podtytuł", baner: "/img/hero.webp" }).length > 0);
  assert.ok(homeProblems({ naglowek: "Nagłówek", podtytul: "Podtytuł", baner: "https://evil.example/a.webp" }).length > 0);
  assert.deepEqual(homeProblems({ naglowek: "Nagłówek", podtytul: "Podtytuł strony", baner: "/img/hero.webp" }), []);
});

test("rozpoznawanie plików i bezpieczny powrót", () => {
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(sniffImage(Uint8Array.from([0x3c, 0x73, 0x76, 0x67])), null);
  assert.equal(safeNextPath("https://zle.example"), "/panel");
  assert.equal(safeNextPath("//zle.example"), "/panel");
  assert.equal(safeNextPath("/panel/1"), "/panel/1");
  assert.equal(parsePositiveInt("0"), null);
  assert.equal(parsePositiveInt("40"), 40);
});
