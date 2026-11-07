import assert from "node:assert/strict";
import test from "node:test";
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

test("rozpoznawanie plików i bezpieczny powrót", () => {
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(sniffImage(Uint8Array.from([0x3c, 0x73, 0x76, 0x67])), null);
  assert.equal(safeNextPath("https://zle.example"), "/panel");
  assert.equal(safeNextPath("//zle.example"), "/panel");
  assert.equal(safeNextPath("/panel/1"), "/panel/1");
  assert.equal(parsePositiveInt("0"), null);
  assert.equal(parsePositiveInt("40"), 40);
});
