import {
  guestLabel,
  hourLabel,
  priceLine,
  typeLabel,
} from "../../domain/rules";
import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { createClient } from "./server";

export type SearchFilters = {
  miasto: string;
  pojemnosc: number | null;
  okazja: string;
  cenaMaxGrosze: number | null;
  udogodnienie: string;
  sort: "cena" | "pojemnosc";
};

export type SearchHit = {
  id: string;
  nazwa: string;
  href: string;
  miasto: string;
  dzielnica: string;
  typ: string;
  pojemnosc: number | null;
  liczbaSal: number;
  cena: string;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  przyklad: boolean;
};

export type Occasion = {
  kod: string;
  nazwa: string;
  nazwa_kafla: string;
  zdjecie: string | null;
};

export type Amenity = { kod: string; nazwa: string; filtr: boolean };

export type PublicRoom = {
  id: string;
  nazwa: string;
  opis: string;
  pojemnosc: number;
  jednostka: string;
  metraz: number | null;
  cena: string;
};

export type PublicPhoto = {
  id: string;
  sciezka: string;
  glowne: boolean;
  podpis: string | null;
  licencja: string | null;
};

export type PublicVenue = {
  id: string;
  nazwa: string;
  miasto: string;
  dzielnica: string;
  adres: string;
  kod: string;
  typ: string;
  opis: string;
  telefon: string | null;
  zasady: string[];
  godziny: string | null;
  jedenObiekt: boolean;
  pojemnosc: number | null;
  cena: string;
  lat: number | null;
  lng: number | null;
  przyklad: boolean;
  sale: PublicRoom[];
  zdjecia: PublicPhoto[];
  udogodnienia: { kod: string; nazwa: string; szczegol: string | null }[];
  okazje: { kod: string; nazwa: string }[];
};

function unconfigured<T>(): DataResult<T> {
  return {
    ok: false,
    reason: "unconfigured",
    detail: "Brak połączenia z bazą.",
  };
}

export async function listOccasions(): Promise<DataResult<Occasion[]>> {
  if (!readPublicEnv().ok) return unconfigured();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("okazje")
      .select("kod, nazwa, nazwa_kafla, zdjecie")
      .order("kolejnosc");
    if (error) return fromSupabaseError(error);
    return { ok: true, data: data ?? [] };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function listAmenities(): Promise<DataResult<Amenity[]>> {
  if (!readPublicEnv().ok) return unconfigured();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("udogodnienia")
      .select("kod, nazwa, filtr")
      .order("kolejnosc");
    if (error) return fromSupabaseError(error);
    return { ok: true, data: (data ?? []).filter((row) => row.filtr) };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function searchVenues(filters: SearchFilters): Promise<DataResult<SearchHit[]>> {
  if (!readPublicEnv().ok) return unconfigured();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("szukaj_lokali", {
      p_miasto: filters.miasto || null,
      p_pojemnosc: filters.pojemnosc,
      p_okazja: filters.okazja || null,
      p_cena_max_grosze: filters.cenaMaxGrosze,
      p_udogodnienie: filters.udogodnienie || null,
      p_sort: filters.sort,
    });
    if (error) return fromSupabaseError(error);
    const hits: SearchHit[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.lokal_id),
      nazwa: String(row.nazwa),
      href: `/sale/${encodeURIComponent(String(row.miasto_norm))}/${encodeURIComponent(String(row.slug))}`,
      miasto: String(row.miasto),
      dzielnica: String(row.dzielnica ?? ""),
      typ: typeLabel(String(row.typ)),
      pojemnosc: row.pojemnosc_max == null ? null : Number(row.pojemnosc_max),
      liczbaSal: Number(row.liczba_sal ?? 0),
      cena: priceLine(
        row.cena_min_grosze == null ? null : Number(row.cena_min_grosze),
        row.jednostka_ceny == null ? null : String(row.jednostka_ceny),
        Boolean(row.cena_na_zapytanie),
      ),
      photo: row.zdjecie_sciezka ? `/media/${row.zdjecie_sciezka}` : null,
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      przyklad: Boolean(row.czy_przyklad),
    }));
    return { ok: true, data: hits };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function getPublishedVenue(miasto: string, slug: string): Promise<DataResult<PublicVenue | null>> {
  if (!readPublicEnv().ok) return unconfigured();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("publikacja_po_adresie", {
      p_miasto: miasto,
      p_slug: slug,
    });
    if (error) return fromSupabaseError(error);
    if (!data) return { ok: true, data: null };
    const payload = data as {
      lokal: Record<string, unknown>;
      sale: Record<string, unknown>[];
      zdjecia: Record<string, unknown>[];
      udogodnienia: { kod: string; nazwa: string; szczegol: string | null }[];
      okazje: { kod: string; nazwa: string }[];
    };
    const lokal = payload.lokal;
    const od = hourLabel(lokal.godziny_od == null ? null : String(lokal.godziny_od));
    const doo = hourLabel(lokal.godziny_do == null ? null : String(lokal.godziny_do));
    const venue: PublicVenue = {
      id: String(lokal.lokal_id),
      nazwa: String(lokal.nazwa),
      miasto: String(lokal.miasto),
      dzielnica: String(lokal.dzielnica ?? ""),
      adres: String(lokal.adres ?? ""),
      kod: String(lokal.kod ?? ""),
      typ: typeLabel(String(lokal.typ)),
      opis: String(lokal.opis ?? ""),
      telefon: lokal.telefon_publiczny ? String(lokal.telefon_publiczny) : null,
      zasady: Array.isArray(lokal.zasady) ? lokal.zasady.map(String) : [],
      godziny: od && doo ? `${od}–${doo}` : od || doo,
      jedenObiekt: Boolean(lokal.jeden_obiekt),
      pojemnosc: lokal.pojemnosc_max == null ? null : Number(lokal.pojemnosc_max),
      cena: priceLine(
        lokal.cena_min_grosze == null ? null : Number(lokal.cena_min_grosze),
        lokal.jednostka_ceny == null ? null : String(lokal.jednostka_ceny),
        Boolean(lokal.cena_na_zapytanie),
      ),
      lat: lokal.lat == null ? null : Number(lokal.lat),
      lng: lokal.lng == null ? null : Number(lokal.lng),
      przyklad: Boolean(lokal.czy_przyklad),
      sale: (payload.sale ?? []).map((room) => ({
        id: String(room.id),
        nazwa: String(room.nazwa),
        opis: String(room.opis_krotki ?? ""),
        pojemnosc: Number(room.pojemnosc_max),
        jednostka: guestLabel(String(room.jednostka)),
        metraz: room.metraz == null ? null : Number(room.metraz),
        cena: room.cena_na_zapytanie
          ? "cena na zapytanie"
          : priceLine(Number(room.kwota_grosze), String(room.jednostka_ceny), false).replace(/^od /, ""),
      })),
      zdjecia: (payload.zdjecia ?? []).map((photo) => ({
        id: String(photo.id),
        sciezka: `/media/${photo.sciezka}`,
        glowne: Boolean(photo.glowne),
        podpis: photo.podpis ? String(photo.podpis) : null,
        licencja: photo.autor_licencja ? String(photo.autor_licencja) : null,
      })),
      udogodnienia: payload.udogodnienia ?? [],
      okazje: payload.okazje ?? [],
    };
    return { ok: true, data: venue };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}
