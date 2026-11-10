import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { createClient } from "./server";

export type InquiryRecord = {
  id: string;
  klientId: string | null;
  lokalId: string;
  salaId: string;
  okazjaKod: string | null;
  data: string;
  godzina: string;
  goscie: number;
  imie: string;
  telefon: string;
  email: string;
  wiadomosc: string | null;
  status: string;
  kwota: number | null;
  utworzono: string;
  lokalNazwa: string | null;
  miasto: string | null;
  href: string | null;
  zdjecie: string | null;
  salaNazwa: string | null;
  okazjaNazwa: string | null;
};

type RawInquiry = {
  id: string;
  klient_id: string | null;
  lokal_id: string;
  sala_id: string;
  okazja_kod: string | null;
  data: string;
  godzina_od: string;
  liczba_gosci: number;
  imie_nazwisko: string;
  telefon: string;
  email: string;
  wiadomosc: string | null;
  status: string;
  kwota_szacunkowa: number | null;
  utworzono: string;
};

const columns =
  "id, klient_id, lokal_id, sala_id, okazja_kod, data, godzina_od, liczba_gosci, imie_nazwisko, telefon, email, wiadomosc, status, kwota_szacunkowa, utworzono";

export async function listOwnInquiries(userId: string): Promise<DataResult<InquiryRecord[]>> {
  return listInquiries({ klientId: userId });
}

export async function getOwnInquiry(userId: string, id: string): Promise<DataResult<InquiryRecord | null>> {
  const result = await getInquiry(id);
  if (!result.ok || !result.data) return result;
  if (result.data.klientId !== userId) return { ok: true, data: null };
  return result;
}

export async function listInquiryPage(filter: {
  status?: string;
  venueId?: string;
  date?: string;
  from: number;
  to: number;
}): Promise<DataResult<{ rows: InquiryRecord[]; total: number }>> {
  const env = readPublicEnv();
  if (!env.ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    let query = supabase.from("zapytania").select(columns, { count: "exact" }).order("utworzono", { ascending: false });
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.venueId) query = query.eq("lokal_id", filter.venueId);
    if (filter.date) query = query.eq("data", filter.date);
    const { data, error, count } = await query.range(filter.from, filter.to);
    if (error) return fromSupabaseError(error);
    return { ok: true, data: { rows: await decorate(supabase, (data ?? []) as RawInquiry[]), total: count ?? 0 } };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function listInquiriesForVenue(venueId: string): Promise<DataResult<InquiryRecord[]>> {
  const listed = await listVenueInquiries();
  if (!listed.ok) return listed;
  return { ok: true, data: listed.data.filter((row) => row.lokalId === venueId) };
}

export async function listVenueInquiries(): Promise<DataResult<InquiryRecord[]>> {
  const listed = await listInquiries({});
  if (!listed.ok) return listed;
  const env = readPublicEnv();
  if (!env.ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("lokale").select("id");
  if (error) return fromSupabaseError(error);
  const venueIds = new Set((data ?? []).map((row) => String(row.id)));
  return { ok: true, data: listed.data.filter((row) => venueIds.has(row.lokalId)) };
}

export async function getVenueInquiry(id: string): Promise<DataResult<InquiryRecord | null>> {
  const result = await getInquiry(id);
  if (!result.ok || !result.data) return result;
  const supabase = await createClient();
  const { data, error } = await supabase.from("lokale").select("id").eq("id", result.data.lokalId).maybeSingle();
  if (error) return fromSupabaseError(error);
  if (!data) return { ok: true, data: null };
  return result;
}

async function listInquiries(filter: { klientId?: string }): Promise<DataResult<InquiryRecord[]>> {
  const env = readPublicEnv();
  if (!env.ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    let query = supabase.from("zapytania").select(columns).order("utworzono", { ascending: false });
    if (filter.klientId) query = query.eq("klient_id", filter.klientId);
    const { data, error } = await query;
    if (error) return fromSupabaseError(error);
    return { ok: true, data: await decorate(supabase, (data ?? []) as RawInquiry[]) };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

async function getInquiry(id: string): Promise<DataResult<InquiryRecord | null>> {
  const env = readPublicEnv();
  if (!env.ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("zapytania").select(columns).eq("id", id).maybeSingle();
    if (error) return fromSupabaseError(error);
    if (!data) return { ok: true, data: null };
    const [row] = await decorate(supabase, [data as RawInquiry]);
    return { ok: true, data: row ?? null };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

async function decorate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: RawInquiry[],
): Promise<InquiryRecord[]> {
  if (rows.length === 0) return [];
  const venueIds = [...new Set(rows.map((row) => row.lokal_id))];
  const roomIds = [...new Set(rows.map((row) => row.sala_id))];
  const [pubs, photos, rooms, occasions, venues] = await Promise.all([
    supabase.from("lokal_publikacje").select("lokal_id, nazwa, miasto, miasto_norm, slug").in("lokal_id", venueIds),
    supabase.from("opublikowane_zdjecia").select("lokal_id, sciezka, glowne, kolejnosc").in("lokal_id", venueIds),
    supabase.from("opublikowane_sale").select("id, nazwa").in("id", roomIds),
    supabase.from("okazje").select("kod, nazwa"),
    supabase.from("lokale").select("id, nazwa, miasto").in("id", venueIds),
  ]);
  const pubById = new Map((pubs.data ?? []).map((row) => [String(row.lokal_id), row]));
  const venueById = new Map((venues.data ?? []).map((row) => [String(row.id), row]));
  const roomById = new Map((rooms.data ?? []).map((row) => [String(row.id), String(row.nazwa)]));
  const occasionByCode = new Map((occasions.data ?? []).map((row) => [String(row.kod), String(row.nazwa)]));
  const photoByVenue = new Map<string, string>();
  const sortedPhotos = [...(photos.data ?? [])].sort((a, b) => {
    if (Boolean(a.glowne) !== Boolean(b.glowne)) return a.glowne ? -1 : 1;
    return Number(a.kolejnosc) - Number(b.kolejnosc);
  });
  for (const photo of sortedPhotos) {
    const id = String(photo.lokal_id);
    if (!photoByVenue.has(id) && photo.sciezka) photoByVenue.set(id, `/media/${photo.sciezka}`);
  }
  return rows.map((row) => {
    const pub = pubById.get(row.lokal_id);
    const own = venueById.get(row.lokal_id);
    const miasto = pub ? String(pub.miasto) : own ? String(own.miasto) : null;
    return {
      id: row.id,
      klientId: row.klient_id,
      lokalId: row.lokal_id,
      salaId: row.sala_id,
      okazjaKod: row.okazja_kod,
      data: String(row.data),
      godzina: String(row.godzina_od),
      goscie: Number(row.liczba_gosci),
      imie: row.imie_nazwisko,
      telefon: row.telefon,
      email: row.email,
      wiadomosc: row.wiadomosc,
      status: row.status,
      kwota: row.kwota_szacunkowa == null ? null : Number(row.kwota_szacunkowa),
      utworzono: row.utworzono,
      lokalNazwa: pub ? String(pub.nazwa) : own ? String(own.nazwa) : null,
      miasto,
      href: pub ? `/sale/${pub.miasto_norm}/${pub.slug}` : null,
      zdjecie: photoByVenue.get(row.lokal_id) ?? null,
      salaNazwa: roomById.get(row.sala_id) ?? null,
      okazjaNazwa: row.okazja_kod ? occasionByCode.get(row.okazja_kod) ?? null : null,
    };
  });
}
