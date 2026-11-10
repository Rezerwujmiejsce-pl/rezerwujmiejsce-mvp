import type { SubmissionState, VenueStatus } from "../../domain/rules";
import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { createClient } from "./server";

export type OwnerRoom = {
  id: string;
  nazwa: string;
  opis: string;
  pojemnosc: number | null;
  jednostka: string;
  metraz: number | null;
  widoczna: boolean;
  kolejnosc: number;
  waluta: string;
  jednostkaCeny: string;
  kwotaGrosze: number | null;
  cenaNaZapytanie: boolean;
  cenaUstalona: boolean;
};

export type OwnerPhoto = {
  id: string;
  sciezka: string;
  glowne: boolean;
  kolejnosc: number;
  podpis: string | null;
  licencja: string | null;
};

export type OwnerMember = {
  profil_id: string;
  email: string | null;
  imie_nazwisko: string | null;
  rola: "wlasciciel" | "manager";
};

export type OwnerVenue = {
  id: string;
  nazwa: string;
  slug: string;
  typ: string;
  opis: string;
  adres: string;
  kod: string;
  miasto: string;
  dzielnica: string;
  lat: number | null;
  lng: number | null;
  telefonPubliczny: string;
  zasady: string;
  godzinyOd: string;
  godzinyDo: string;
  jedenObiekt: boolean;
  status: VenueStatus;
  statusZgloszenia: SubmissionState;
  powod: string | null;
  dirty: boolean;
  przyklad: boolean;
  rezerwacjeWstrzymane: boolean;
  emailKontaktowy: string;
  telefonWewnetrzny: string;
  notatka: string;
  okazje: string[];
  udogodnienia: { kod: string; szczegol: string }[];
  sale: OwnerRoom[];
  zdjecia: OwnerPhoto[];
  czlonkowie: OwnerMember[];
};

export type OwnerSummary = {
  id: string;
  nazwa: string;
  miasto: string;
  status: VenueStatus;
  statusZgloszenia: SubmissionState;
  dirty: boolean;
  przyklad: boolean;
};

export async function listMine(): Promise<DataResult<OwnerSummary[]>> {
  if (!readPublicEnv().ok) {
    return { ok: false, reason: "unconfigured", detail: "Brak połączenia z bazą." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lokale")
      .select("id, nazwa, miasto, status, status_zgloszenia, ma_nieopublikowane_zmiany, czy_przyklad")
      .order("zmieniono", { ascending: false });
    if (error) return fromSupabaseError(error);
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        nazwa: row.nazwa || "Lokal bez nazwy",
        miasto: row.miasto,
        status: row.status,
        statusZgloszenia: row.status_zgloszenia,
        dirty: row.ma_nieopublikowane_zmiany,
        przyklad: row.czy_przyklad,
      })),
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function getMine(id: string): Promise<DataResult<OwnerVenue | null>> {
  if (!readPublicEnv().ok) {
    return { ok: false, reason: "unconfigured", detail: "Brak połączenia z bazą." };
  }
  try {
    const supabase = await createClient();
    const [venueResult, privateRow, occasions, amenities, rooms, photos, members, pauseRow] = await Promise.all([
      supabase.from("lokale").select("*").eq("id", id).maybeSingle(),
      supabase.from("lokal_dane_prywatne").select("*").eq("lokal_id", id).maybeSingle(),
      supabase.from("lokal_okazje").select("kod").eq("lokal_id", id),
      supabase.from("lokal_udogodnienia").select("kod, szczegol").eq("lokal_id", id),
      supabase.from("sale").select("*, ceny_sal(*)").eq("lokal_id", id).order("kolejnosc"),
      supabase.from("zdjecia").select("*").eq("lokal_id", id).order("kolejnosc"),
      supabase.rpc("lista_czlonkow", { p_lokal: id }),
      supabase.from("dostepnosc_rezerwacji").select("wstrzymane").eq("lokal_id", id).maybeSingle(),
    ]);
    if (venueResult.error) return fromSupabaseError(venueResult.error);
    const venue = venueResult.data;
    if (!venue) return { ok: true, data: null };
    for (const result of [privateRow, occasions, amenities, rooms, photos, members]) {
      if (result.error) return fromSupabaseError(result.error);
    }
    const pauseMissing = pauseRow.error && /42P01|PGRST205|does not exist|schema cache/i.test(`${pauseRow.error.code ?? ""} ${pauseRow.error.message ?? ""}`);
    if (pauseRow.error && !pauseMissing) return fromSupabaseError(pauseRow.error);

    const mapped: OwnerVenue = {
      id: venue.id,
      nazwa: venue.nazwa ?? "",
      slug: venue.slug ?? "",
      typ: venue.typ,
      opis: venue.opis ?? "",
      adres: venue.adres ?? "",
      kod: venue.kod ?? "",
      miasto: venue.miasto ?? "",
      dzielnica: venue.dzielnica ?? "",
      lat: venue.lat == null ? null : Number(venue.lat),
      lng: venue.lng == null ? null : Number(venue.lng),
      telefonPubliczny: venue.telefon_publiczny ?? "",
      zasady: Array.isArray(venue.zasady) ? venue.zasady.join("\n") : "",
      godzinyOd: venue.godziny_od ? String(venue.godziny_od).slice(0, 5) : "",
      godzinyDo: venue.godziny_do ? String(venue.godziny_do).slice(0, 5) : "",
      jedenObiekt: venue.jeden_obiekt,
      status: venue.status,
      statusZgloszenia: venue.status_zgloszenia,
      powod: venue.powod_odrzucenia,
      dirty: venue.ma_nieopublikowane_zmiany,
      przyklad: venue.czy_przyklad,
      rezerwacjeWstrzymane: Boolean(pauseRow.data?.wstrzymane),
      emailKontaktowy: privateRow.data?.email_kontaktowy ?? "",
      telefonWewnetrzny: privateRow.data?.telefon_wewnetrzny ?? "",
      notatka: privateRow.data?.notatka ?? "",
      okazje: (occasions.data ?? []).map((row) => row.kod),
      udogodnienia: (amenities.data ?? []).map((row) => ({
        kod: row.kod,
        szczegol: row.szczegol ?? "",
      })),
      sale: (rooms.data ?? []).map((room) => {
        const price = Array.isArray(room.ceny_sal) ? room.ceny_sal[0] : room.ceny_sal;
        return {
          id: room.id,
          nazwa: room.nazwa ?? "",
          opis: room.opis_krotki ?? "",
          pojemnosc: room.pojemnosc_max,
          jednostka: room.jednostka,
          metraz: room.metraz,
          widoczna: room.widoczna,
          kolejnosc: room.kolejnosc,
          waluta: price?.waluta ?? "PLN",
          jednostkaCeny: price?.jednostka ?? "za_sale",
          kwotaGrosze: price?.kwota_grosze ?? null,
          cenaNaZapytanie: Boolean(price?.cena_na_zapytanie),
          cenaUstalona: Boolean(price),
        };
      }),
      zdjecia: (photos.data ?? []).map((photo) => ({
        id: photo.id,
        sciezka: photo.sciezka,
        glowne: photo.glowne,
        kolejnosc: photo.kolejnosc,
        podpis: photo.podpis,
        licencja: photo.autor_licencja,
      })),
      czlonkowie: ((members.data ?? []) as OwnerMember[]).filter((member) => member.profil_id),
    };
    return { ok: true, data: mapped };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function listPending(): Promise<DataResult<OwnerSummary[]>> {
  if (!readPublicEnv().ok) {
    return { ok: false, reason: "unconfigured", detail: "Brak połączenia z bazą." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lokale")
      .select("id, nazwa, miasto, status, status_zgloszenia, ma_nieopublikowane_zmiany, czy_przyklad, wyslano_o")
      .or("status.eq.pending_review,status_zgloszenia.eq.pending_review")
      .order("wyslano_o", { ascending: true });
    if (error) return fromSupabaseError(error);
    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        nazwa: row.nazwa || "Lokal bez nazwy",
        miasto: row.miasto,
        status: row.status,
        statusZgloszenia: row.status_zgloszenia,
        dirty: row.ma_nieopublikowane_zmiany,
        przyklad: row.czy_przyklad,
      })),
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}
