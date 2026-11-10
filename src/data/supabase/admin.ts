import {
  ADMIN_PAGE_SIZE,
  adminInquiryStatusFilter,
  adminPageNumber,
  adminVenueStatusFilter,
  isoDayFilter,
  ownerDisplayName,
  plainCityFilter,
} from "../../domain/admin";
import type { VenueStatus, SubmissionState } from "../../domain/rules";
import { fromSupabaseError, type DataResult } from "../result";
import { readPublicEnv } from "../setup";
import { listInquiryPage, type InquiryRecord } from "./inquiries";
import { createClient } from "./server";

export type AdminVenueRow = {
  id: string;
  nazwa: string;
  miasto: string;
  miastoNorm: string;
  slug: string;
  status: VenueStatus;
  statusZgloszenia: SubmissionState;
  utworzono: string;
  wlasciciel: string;
};

export type AdminVenuePage = {
  rows: AdminVenueRow[];
  page: number;
  pages: number;
};

export async function listAdminVenues(query: {
  status?: string;
  city?: string;
  page?: string;
}): Promise<DataResult<AdminVenuePage>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  const page = adminPageNumber(query.page);
  const status = adminVenueStatusFilter(query.status);
  const city = plainCityFilter(query.city);
  try {
    const supabase = await createClient();
    let request = supabase
      .from("lokale")
      .select("id, nazwa, miasto, miasto_norm, slug, status, status_zgloszenia, utworzono, wlasciciel_id", { count: "exact" })
      .order("utworzono", { ascending: false });
    if (status) request = request.eq("status", status);
    if (city) request = request.ilike("miasto", `%${city}%`);
    const from = (page - 1) * ADMIN_PAGE_SIZE;
    const { data, error, count } = await request.range(from, from + ADMIN_PAGE_SIZE - 1);
    if (error) return fromSupabaseError(error);
    const ownerIds = [...new Set((data ?? []).map((row) => String(row.wlasciciel_id)))];
    const names = new Map<string, string>();
    if (ownerIds.length > 0) {
      const profiles = await supabase.from("profile").select("id, imie_nazwisko").in("id", ownerIds);
      if (profiles.error) return fromSupabaseError(profiles.error);
      for (const profile of profiles.data ?? []) {
        names.set(String(profile.id), ownerDisplayName(profile.imie_nazwisko));
      }
    }
    const total = count ?? 0;
    return {
      ok: true,
      data: {
        page,
        pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
        rows: (data ?? []).map((row) => ({
          id: String(row.id),
          nazwa: String(row.nazwa || "Szkic bez nazwy"),
          miasto: String(row.miasto ?? ""),
          miastoNorm: String(row.miasto_norm ?? ""),
          slug: String(row.slug ?? ""),
          status: row.status as VenueStatus,
          statusZgloszenia: row.status_zgloszenia as SubmissionState,
          utworzono: String(row.utworzono),
          wlasciciel: names.get(String(row.wlasciciel_id)) ?? "Brak nazwy w profilu",
        })),
      },
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export type AdminInquiryRow = InquiryRecord & { wlasciciel: string };

export async function listVenueChoices(): Promise<DataResult<{ id: string; nazwa: string }[]>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("lokale").select("id, nazwa").order("nazwa").limit(200);
    if (error) return fromSupabaseError(error);
    return {
      ok: true,
      data: (data ?? []).map((row) => ({ id: String(row.id), nazwa: String(row.nazwa || "Szkic bez nazwy") })),
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}

export async function listAdminInquiries(query: {
  status?: string;
  venue?: string;
  date?: string;
  page?: string;
}): Promise<DataResult<{ rows: AdminInquiryRow[]; page: number; pages: number }>> {
  if (!readPublicEnv().ok) return { ok: false, reason: "unconfigured", detail: "Brak konfiguracji bazy." };
  const page = adminPageNumber(query.page);
  const status = adminInquiryStatusFilter(query.status);
  const date = isoDayFilter(query.date);
  const venue = /^[0-9a-f-]{36}$/i.test(query.venue ?? "") ? query.venue : "";
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  const listed = await listInquiryPage({
    status: status || undefined,
    venueId: venue || undefined,
    date: date || undefined,
    from,
    to: from + ADMIN_PAGE_SIZE - 1,
  });
  if (!listed.ok) return listed;
  try {
    const supabase = await createClient();
    const venueIds = [...new Set(listed.data.rows.map((row) => row.lokalId))];
    const owners = new Map<string, string>();
    if (venueIds.length > 0) {
      const venues = await supabase.from("lokale").select("id, wlasciciel_id").in("id", venueIds);
      if (venues.error) return fromSupabaseError(venues.error);
      const ownerIds = [...new Set((venues.data ?? []).map((row) => String(row.wlasciciel_id)))];
      const profiles = ownerIds.length
        ? await supabase.from("profile").select("id, imie_nazwisko").in("id", ownerIds)
        : { data: [], error: null };
      if (profiles.error) return fromSupabaseError(profiles.error);
      const names = new Map((profiles.data ?? []).map((row) => [String(row.id), ownerDisplayName(row.imie_nazwisko)]));
      for (const row of venues.data ?? []) {
        owners.set(String(row.id), names.get(String(row.wlasciciel_id)) ?? "Brak nazwy w profilu");
      }
    }
    return {
      ok: true,
      data: {
        rows: listed.data.rows.map((row) => ({ ...row, wlasciciel: owners.get(row.lokalId) ?? "Brak nazwy w profilu" })),
        page,
        pages: Math.max(1, Math.ceil(listed.data.total / ADMIN_PAGE_SIZE)),
      },
    };
  } catch (error) {
    return fromSupabaseError(error as { message: string });
  }
}
