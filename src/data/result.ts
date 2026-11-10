export type Failure = {
  ok: false;
  reason: "unconfigured" | "unreachable" | "denied" | "invalid";
  detail: string;
};

export type DataResult<T> = { ok: true; data: T } | Failure;

export function invalid(detail: string): Failure {
  return { ok: false, reason: "invalid", detail };
}

export function denied(detail: string): Failure {
  return { ok: false, reason: "denied", detail };
}

export function fromSupabaseError(error: { message?: string; code?: string } | null): Failure {
  const message = error?.message ?? "";
  const code = error?.code ?? "";
  if (
    /fetch failed|Failed to fetch|ECONNREFUSED|ENOTFOUND|network|fetch/i.test(message) ||
    code === "" && /fetch|network|connect/i.test(message)
  ) {
    return {
      ok: false,
      reason: "unreachable",
      detail: "Nie udało się połączyć z bazą. Sprawdź, czy lokalny Supabase jest uruchomiony i czy adres w .env.local jest zgodny z supabase status.",
    };
  }
  if (code === "42501" || /42501|row-level security|permission denied/i.test(message)) {
    return { ok: false, reason: "denied", detail: message || "Brak uprawnień do tej operacji." };
  }
  if (code === "P0001" || code === "23514" || code === "23505" || code === "22P02") {
    return { ok: false, reason: "invalid", detail: polishDbMessage(message) };
  }
  if (/^Podaj |^Dodaj |^Każda |^Tylko |^Nie |^Brak |^To zgłoszenie|^Administratora|^Najpierw|^Członków|^Lokal musi|^Ten adres|^Uzupełnij|^Data |^Wybierz|^Ta sala|^Ten lokal|^Za dużo|^Zapytanie /.test(message)) {
    return { ok: false, reason: "invalid", detail: message };
  }
  console.error("supabase", code, message);
  return {
    ok: false,
    reason: "unreachable",
    detail: "Operacja w bazie nie doszła do skutku. Szczegół jest w logu serwera, na stronie nie pokazujemy surowego błędu technicznego.",
  };
}

function polishDbMessage(message: string): string {
  if (/lokale_slug_format|slug/.test(message) && /check|constraint/i.test(message)) {
    return "Końcówka adresu może zawierać tylko małe litery, cyfry i łączniki.";
  }
  if (/ceny_sens/.test(message)) {
    return "Podaj kwotę albo zaznacz cenę na zapytanie — nie oba naraz.";
  }
  if (/duplicate key|lokale_slug_miasto/.test(message)) {
    return "Taki adres strony jest już zajęty w tym mieście. Zmień końcówkę.";
  }
  if (/zdjecia_/.test(message)) {
    return "Plik zdjęcia nie przeszedł kontroli typu albo rozmiaru (JPEG, PNG lub WebP, do 8 MB).";
  }
  return message.replace(/^.*ERROR:\s*/i, "").trim() || "Danych nie udało się zapisać.";
}
