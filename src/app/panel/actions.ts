"use server";

import { redirect } from "next/navigation";
import { parseCoordinatePair } from "../../domain/map-points";
import { plainTextProblem } from "../../domain/venues";
import { extensionFor, sniffImage, zlotyToGrosze, type ImageMime } from "../../domain/rules";
import { fromSupabaseError } from "../../data/result";
import { readPublicEnv } from "../../data/setup";
import { createClient } from "../../data/supabase/server";

function back(id: string, detail: string): never {
  redirect(`/panel/${id}?blad=${encodeURIComponent(detail)}`);
}

function ok(id: string, detail = "Zapisane."): never {
  redirect(`/panel/${id}?info=${encodeURIComponent(detail)}`);
}

async function db() {
  if (!readPublicEnv().ok) redirect("/panel?blad=" + encodeURIComponent("Brak konfiguracji bazy."));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie?next=/panel");
  return supabase;
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}


export async function createVenue(formData: FormData) {
  const supabase = await db();
  const { data, error } = await supabase.rpc("utworz_lokal", {
    p_nazwa: text(formData, "nazwa"),
    p_miasto: text(formData, "miasto") || "Zielona Góra",
  });
  if (error || !data) {
    redirect("/panel?blad=" + encodeURIComponent(error ? fromSupabaseError(error).detail : "Nie udało się utworzyć lokalu."));
  }
  redirect(`/panel/${data}`);
}

export async function saveVenue(formData: FormData) {
  const id = text(formData, "id");
  const supabase = await db();
  let lat: number | null;
  let lng: number | null;
  try {
    const pair = parseCoordinatePair(text(formData, "lat"), text(formData, "lng"));
    lat = pair.lat;
    lng = pair.lng;
  } catch (error) {
    back(id, error instanceof Error ? error.message : "Złe współrzędne.");
  }
  const nazwa = text(formData, "nazwa");
  const opis = String(formData.get("opis") ?? "");
  const adres = text(formData, "adres");
  const dzielnica = text(formData, "dzielnica");
  const telefon = text(formData, "telefon_publiczny");
  const notatka = text(formData, "notatka");
  const textError = [
    plainTextProblem("Nazwa", nazwa, 120),
    plainTextProblem("Opis", opis, 8000),
    plainTextProblem("Adres", adres, 200),
    plainTextProblem("Dzielnica", dzielnica, 120),
    plainTextProblem("Telefon", telefon, 40),
    plainTextProblem("Notatka", notatka, 4000),
  ].find(Boolean);
  if (textError) back(id, textError);
  const zasady = String(formData.get("zasady") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  const { error } = await supabase
    .from("lokale")
    .update({
      nazwa,
      slug: text(formData, "slug"),
      typ: text(formData, "typ") || "inne",
      opis,
      adres,
      kod: text(formData, "kod"),
      miasto: text(formData, "miasto"),
      dzielnica,
      lat,
      lng,
      telefon_publiczny: telefon || null,
      zasady,
      godziny_od: text(formData, "godziny_od") || null,
      godziny_do: text(formData, "godziny_do") || null,
      jeden_obiekt: formData.get("jeden_obiekt") === "on",
    })
    .eq("id", id);
  if (error) back(id, fromSupabaseError(error).detail);

  const { error: privateError } = await supabase
    .from("lokal_dane_prywatne")
    .update({
      email_kontaktowy: text(formData, "email_kontaktowy") || null,
      telefon_wewnetrzny: text(formData, "telefon_wewnetrzny") || null,
      notatka: notatka || null,
    })
    .eq("lokal_id", id);
  if (privateError) back(id, fromSupabaseError(privateError).detail);

  const { error: dropOccasions } = await supabase.from("lokal_okazje").delete().eq("lokal_id", id);
  if (dropOccasions) back(id, fromSupabaseError(dropOccasions).detail);
  const occasions = formData.getAll("okazja").map(String).filter(Boolean);
  if (occasions.length) {
    const { error: insertOccasions } = await supabase
      .from("lokal_okazje")
      .insert(occasions.map((kod) => ({ lokal_id: id, kod })));
    if (insertOccasions) back(id, fromSupabaseError(insertOccasions).detail);
  }

  const { error: dropAmenities } = await supabase.from("lokal_udogodnienia").delete().eq("lokal_id", id);
  if (dropAmenities) back(id, fromSupabaseError(dropAmenities).detail);
  const amenities = formData.getAll("udogodnienie").map(String).filter(Boolean);
  if (amenities.length) {
    const { error: insertAmenities } = await supabase.from("lokal_udogodnienia").insert(
      amenities.map((kod) => ({
        lokal_id: id,
        kod,
        szczegol: text(formData, `szczegol_${kod}`) || null,
      })),
    );
    if (insertAmenities) back(id, fromSupabaseError(insertAmenities).detail);
  }
  ok(id, "Wersja robocza zapisana. Nie została opublikowana.");
}

export async function saveRoom(formData: FormData) {
  const id = text(formData, "lokal");
  const roomId = text(formData, "sala");
  const supabase = await db();
  const capacityRaw = text(formData, "pojemnosc");
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  if (capacityRaw && (!Number.isInteger(capacity) || (capacity ?? 0) < 1 || (capacity ?? 0) > 5000)) {
    back(id, "Liczba gości musi być liczbą całkowitą od 1 do 5000 albo zostać pusta w szkicu.");
  }
  const areaRaw = text(formData, "metraz");
  const area = areaRaw ? Number(areaRaw) : null;
  if (areaRaw && (!Number.isInteger(area) || (area ?? 0) < 1)) {
    back(id, "Metraż podaj w metrach, jako liczbę całkowitą, albo zostaw puste.");
  }
  const onRequest = formData.get("cena_na_zapytanie") === "on";
  const amount = zlotyToGrosze(text(formData, "kwota"));
  if (!onRequest && text(formData, "kwota") && amount == null) {
    back(id, "Kwota może mieć najwyżej dwa miejsca po przecinku.");
  }
  if (!onRequest && amount == null && text(formData, "kwota") === "" && formData.get("wymagaj_ceny") === "1") {
    back(id, "Podaj kwotę albo zaznacz cenę na zapytanie.");
  }

  const roomName = text(formData, "nazwa");
  const roomNote = text(formData, "opis");
  const roomText = plainTextProblem("Nazwa sali", roomName, 120) || plainTextProblem("Opis sali", roomNote, 500);
  if (roomText) back(id, roomText);
  const payload = {
    lokal_id: id,
    nazwa: roomName,
    opis_krotki: roomNote,
    pojemnosc_max: capacity,
    jednostka: text(formData, "jednostka") || "osoby",
    metraz: area,
    widoczna: formData.get("widoczna") === "on",
    kolejnosc: Number(text(formData, "kolejnosc") || "0"),
  };

  let savedId = roomId;
  if (roomId) {
    const { error } = await supabase.from("sale").update(payload).eq("id", roomId);
    if (error) back(id, fromSupabaseError(error).detail);
  } else {
    const { data, error } = await supabase.from("sale").insert(payload).select("id").single();
    if (error || !data) back(id, error ? fromSupabaseError(error).detail : "Nie udało się dodać sali.");
    savedId = data.id;
  }

  if (onRequest || amount != null) {
    const price = {
      sala_id: savedId,
      waluta: (text(formData, "waluta") || "PLN").toUpperCase(),
      jednostka: text(formData, "jednostka_ceny") || "za_sale",
      kwota_grosze: onRequest ? null : amount,
      cena_na_zapytanie: onRequest,
    };
    const { error } = await supabase.from("ceny_sal").upsert(price);
    if (error) back(id, fromSupabaseError(error).detail);
  }
  ok(id, roomId ? "Sala zapisana." : "Sala dodana.");
}

export async function deleteRoom(formData: FormData) {
  const id = text(formData, "lokal");
  const supabase = await db();
  const { error } = await supabase.from("sale").delete().eq("id", text(formData, "sala"));
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Sala usunięta.");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function registerPhoto(formData: FormData) {
  const venueId = text(formData, "lokal");
  const photoId = text(formData, "id");
  const ext = text(formData, "ext");
  if (!UUID.test(venueId) || !UUID.test(photoId) || !["jpg", "png", "webp"].includes(ext)) {
    back(venueId || "x", "Nieprawidłowy plik zdjęcia.");
  }
  const path = `${venueId}/${photoId}.${ext}`;
  const supabase = await db();
  const downloaded = await supabase.storage.from("zdjecia-lokali").download(path);
  if (downloaded.error || !downloaded.data) {
    back(venueId, "Plik nie zapisał się w magazynie. Sprawdź, czy jesteś zalogowany jako osoba od tego lokalu.");
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  const mime = sniffImage(bytes);
  const expected = mime ? extensionFor(mime) : null;
  if (!mime || expected !== ext) {
    await supabase.storage.from("zdjecia-lokali").remove([path]);
    back(venueId, "Przyjmujemy tylko prawdziwe pliki JPEG, PNG i WebP do 8 MB. To limit techniczny, nie wymóg liczby zdjęć.");
  }
  const { count } = await supabase.from("zdjecia").select("id", { count: "exact", head: true }).eq("lokal_id", venueId);
  const { error } = await supabase.from("zdjecia").insert({
    id: photoId,
    lokal_id: venueId,
    sciezka: path,
    mime: mime as ImageMime,
    rozmiar_bajty: bytes.length,
    kolejnosc: count ?? 0,
    glowne: (count ?? 0) === 0,
    podpis: text(formData, "podpis") || null,
  });
  if (error) {
    await supabase.storage.from("zdjecia-lokali").remove([path]);
    back(venueId, fromSupabaseError(error).detail);
  }
  ok(venueId, "Zdjęcie dodane. Na stronie pojawi się dopiero po akceptacji administratora.");
}

export async function updatePhoto(formData: FormData) {
  const venueId = text(formData, "lokal");
  const supabase = await db();
  const { error } = await supabase
    .from("zdjecia")
    .update({
      podpis: text(formData, "podpis") || null,
      autor_licencja: text(formData, "licencja") || null,
      glowne: formData.get("glowne") === "on",
      kolejnosc: Number(text(formData, "kolejnosc") || "0"),
    })
    .eq("id", text(formData, "id"));
  if (error) back(venueId, fromSupabaseError(error).detail);
  ok(venueId, "Zdjęcie zaktualizowane.");
}

export async function deletePhoto(formData: FormData) {
  const venueId = text(formData, "lokal");
  const path = text(formData, "sciezka");
  const supabase = await db();
  const { error } = await supabase.from("zdjecia").delete().eq("id", text(formData, "id"));
  if (error) back(venueId, fromSupabaseError(error).detail);
  const live = path
    ? await supabase.from("opublikowane_zdjecia").select("id").eq("sciezka", path).maybeSingle()
    : { data: null };
  if (path && !live.data) {
    await supabase.storage.from("zdjecia-lokali").remove([path]);
  }
  ok(
    venueId,
    live.data
      ? "Zdjęcie zniknęło ze szkicu. Opublikowany plik zostaje do kolejnej akceptacji — nie da się go nadpisać ani skasować wcześniej."
      : "Zdjęcie usunięte ze szkicu.",
  );
}

export async function submitVenue(formData: FormData) {
  const id = text(formData, "id");
  const supabase = await db();
  const { error } = await supabase.rpc("wyslij_do_weryfikacji", { p_lokal: id });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Wysłane do weryfikacji. Dopóki administrator nie zaakceptuje, goście nie zobaczą nowych treści.");
}

export async function withdrawVenue(formData: FormData) {
  const id = text(formData, "id");
  const supabase = await db();
  const { error } = await supabase.rpc("cofnij_zgloszenie", { p_lokal: id });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Zgłoszenie cofnięte.");
}

function confirmed(formData: FormData, id: string, message: string) {
  if (formData.get("potwierdz") !== "tak") back(id, message);
}

export async function pauseBookings(formData: FormData) {
  const id = text(formData, "id");
  confirmed(formData, id, "Zaznacz potwierdzenie, żeby wstrzymać przyjmowanie zapytań.");
  const supabase = await db();
  const { error } = await supabase.rpc("wstrzymaj_rezerwacje", { p_lokal: id });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Rezerwacje wstrzymane. Strona lokalu zostaje widoczna, nowe zapytanie nie przejdzie. Godziny bez zmian.");
}

export async function resumeBookings(formData: FormData) {
  const id = text(formData, "id");
  confirmed(formData, id, "Zaznacz potwierdzenie, żeby wznowić przyjmowanie zapytań.");
  const supabase = await db();
  const { error } = await supabase.rpc("wznow_rezerwacje", { p_lokal: id });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Przyjmowanie zapytań wznowione. To nie publikuje szkicu i nie zdejmuje zawieszenia administratora.");
}

export async function archiveOwnVenue(formData: FormData) {
  const id = text(formData, "id");
  confirmed(formData, id, "Zaznacz potwierdzenie, żeby wycofać lokal z serwisu.");
  const supabase = await db();
  const { error } = await supabase.rpc("wycofaj_wlasny_lokal", { p_lokal: id });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Lokal wycofany z serwisu. Wiersz i zapytania zostały. To nie jest wstrzymanie rezerwacji.");
}

export async function addMember(formData: FormData) {
  const id = text(formData, "id");
  const supabase = await db();
  const role = text(formData, "rola") === "manager" ? "manager" : "wlasciciel";
  const { error } = await supabase.rpc("dodaj_czlonka", {
    p_lokal: id,
    p_email: text(formData, "email"),
    p_rola: role,
  });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Osoba dodana do lokalu. To nie nadaje roli administratora portalu.");
}

export async function removeMember(formData: FormData) {
  const id = text(formData, "id");
  const supabase = await db();
  const { error } = await supabase.rpc("usun_czlonka", {
    p_lokal: id,
    p_profil: text(formData, "profil"),
  });
  if (error) back(id, fromSupabaseError(error).detail);
  ok(id, "Osoba usunięta z lokalu.");
}
