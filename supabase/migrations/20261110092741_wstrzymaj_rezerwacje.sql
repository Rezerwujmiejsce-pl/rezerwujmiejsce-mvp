-- Właściciel wstrzymuje przyjmowanie rezerwacji. Strona lokalu zostaje.
-- To nie jest zawieszenie przez administratora i nie jest wycofanie lokalu.
-- Nie zmienia statusu moderacji, godzin ani treści migawki.
-- Nie wgrywać na DEV z tego środowiska. Po 20261110092253 i po wycofaniu własnym,
-- jeśli tamten plik też jest w kolejce.

create table public.dostepnosc_rezerwacji (
  lokal_id uuid primary key references public.lokale (id) on delete cascade,
  wstrzymane boolean not null default false,
  zmieniono timestamptz not null default now()
);

comment on table public.dostepnosc_rezerwacji is
  'Flaga właściciela: lokal widoczny, ale nie przyjmuje nowych zapytań. Godziny zostają w lokale.';

alter table public.dostepnosc_rezerwacji enable row level security;
alter table public.dostepnosc_rezerwacji force row level security;

revoke all on table public.dostepnosc_rezerwacji from public, anon, authenticated;
grant select on table public.dostepnosc_rezerwacji to anon, authenticated;

create policy dostepnosc_czytaj on public.dostepnosc_rezerwacji
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.lokal_publikacje p
      where p.lokal_id = dostepnosc_rezerwacji.lokal_id
    )
    or private.jest_czlonkiem(lokal_id)
    or (select private.jest_admin())
  );

create or replace function private.ustaw_wstrzymanie_rezerwacji(p_lokal uuid, p_wstrzymane boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lokal is null or not private.jest_wlascicielem_lokalu(p_lokal) then
    raise exception 'Rezerwacje tego lokalu wstrzymuje tylko jego właściciel.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lokale where id = p_lokal) then
    raise exception 'Nie ma takiego lokalu.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-lokal:' || p_lokal::text, 0));
  insert into public.dostepnosc_rezerwacji (lokal_id, wstrzymane, zmieniono)
  values (p_lokal, coalesce(p_wstrzymane, false), now())
  on conflict (lokal_id) do update
    set wstrzymane = excluded.wstrzymane,
        zmieniono = now();
end;
$$;

comment on function private.ustaw_wstrzymanie_rezerwacji(uuid, boolean) is
  'Ustawia tylko flagę wstrzymania. Nie publikuje szkicu, nie zmienia statusu i nie rusza godzin.';

create or replace function public.wstrzymaj_rezerwacje(p_lokal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.ustaw_wstrzymanie_rezerwacji(p_lokal, true);
end;
$$;

create or replace function public.wznow_rezerwacje(p_lokal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.ustaw_wstrzymanie_rezerwacji(p_lokal, false);
end;
$$;

revoke all on function private.ustaw_wstrzymanie_rezerwacji(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.wstrzymaj_rezerwacje(uuid) from public, anon, authenticated, service_role;
revoke all on function public.wznow_rezerwacje(uuid) from public, anon, authenticated, service_role;
grant execute on function private.ustaw_wstrzymanie_rezerwacji(uuid, boolean) to authenticated;
grant execute on function public.wstrzymaj_rezerwacje(uuid) to authenticated;
grant execute on function public.wznow_rezerwacje(uuid) to authenticated;

create or replace function private.wyslij_zapytanie(
  p_lokal uuid,
  p_sala uuid,
  p_okazja text,
  p_data date,
  p_godzina time,
  p_goscie integer,
  p_imie text,
  p_telefon text,
  p_email text,
  p_wiadomosc text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_okazja text := nullif(btrim(coalesce(p_okazja, '')), '');
  v_imie text := btrim(coalesce(p_imie, ''));
  v_telefon text := btrim(coalesce(p_telefon, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_wiadomosc text := nullif(btrim(coalesce(p_wiadomosc, '')), '');
  v_pojemnosc integer;
  v_grosze integer;
  v_na_zapytanie boolean;
  v_jednostka text;
  v_kwota integer;
  v_uid uuid := auth.uid();
  v_dzis date := (now() at time zone 'Europe/Warsaw')::date;
begin
  if p_lokal is null or p_sala is null or p_data is null or p_godzina is null then
    raise exception 'Uzupełnij lokal, salę, datę i godzinę.';
  end if;
  if p_goscie is null or p_goscie < 1 or p_goscie > 5000 then
    raise exception 'Podaj liczbę gości od 1 do 5000.';
  end if;
  if char_length(v_imie) < 2 or char_length(v_imie) > 120 then
    raise exception 'Podaj imię i nazwisko (2–120 znaków).';
  end if;
  if char_length(v_telefon) < 7 or char_length(v_telefon) > 32
     or v_telefon !~ '^[0-9 +()-]+$' then
    raise exception 'Podaj numer telefonu.';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Podaj adres e-mail.';
  end if;
  if v_wiadomosc is not null and char_length(v_wiadomosc) > 2000 then
    raise exception 'Wiadomość może mieć najwyżej 2000 znaków.';
  end if;
  if p_data < v_dzis or p_data > v_dzis + 540 then
    raise exception 'Data musi być dzisiaj albo w ciągu najbliższych 18 miesięcy.';
  end if;
  if v_okazja is not null and v_okazja !~ '^[a-z0-9_]{2,40}$' then
    raise exception 'Wybierz okazję z listy.';
  end if;

  if not exists (
    select 1 from public.lokal_publikacje where lokal_id = p_lokal
  ) then
    raise exception 'Ten lokal nie jest opublikowany.';
  end if;

  select s.pojemnosc_max, s.kwota_grosze, s.cena_na_zapytanie, s.jednostka_ceny::text
    into v_pojemnosc, v_grosze, v_na_zapytanie, v_jednostka
  from public.opublikowane_sale s
  where s.id = p_sala
    and s.lokal_id = p_lokal;

  if not found then
    raise exception 'Wybierz salę z opublikowanego opisu tego lokalu.';
  end if;
  if p_goscie > v_pojemnosc then
    raise exception 'Ta sala nie mieści tylu gości.';
  end if;

  if v_okazja is not null and not exists (
    select 1 from public.opublikowane_okazje o
    where o.lokal_id = p_lokal and o.kod = v_okazja
  ) then
    raise exception 'Ten lokal nie ma takiej okazji w opublikowanym opisie.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-email:' || lower(v_email), 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-lokal:' || p_lokal::text, 0));

  if exists (
    select 1 from public.dostepnosc_rezerwacji d
    where d.lokal_id = p_lokal and d.wstrzymane
  ) then
    raise exception 'Ten lokal chwilowo nie przyjmuje rezerwacji. Zapytanie nie zostało zapisane.';
  end if;

  if (
    select count(*) from public.zapytania
    where lower(email) = lower(v_email)
      and utworzono > now() - interval '1 hour'
  ) >= 8 then
    raise exception 'Za dużo zapytań z tego adresu w krótkim czasie. Spróbuj później.';
  end if;
  if (
    select count(*) from public.zapytania
    where lokal_id = p_lokal
      and utworzono > now() - interval '1 hour'
  ) >= 40 then
    raise exception 'Ten lokal dostał już dużo zapytań w tej godzinie. Spróbuj później.';
  end if;

  v_kwota := null;
  if not v_na_zapytanie and v_grosze is not null and v_grosze >= 0 then
    if v_jednostka = 'za_osobe' then
      if v_grosze::numeric * p_goscie <= 2000000000 then
        v_kwota := v_grosze * p_goscie;
      end if;
    elsif v_jednostka = 'za_sale' then
      v_kwota := v_grosze;
    end if;
  end if;

  perform set_config('app.allow_inquiry_change', '1', true);
  insert into public.zapytania (
    lokal_id, sala_id, klient_id, okazja_kod, data, godzina_od, liczba_gosci,
    imie_nazwisko, telefon, email, wiadomosc, status, kwota_szacunkowa, zrodlo
  ) values (
    p_lokal, p_sala, v_uid, v_okazja, p_data, p_godzina, p_goscie,
    v_imie, v_telefon, v_email, v_wiadomosc, 'nowe', v_kwota, 'strona_lokalu'
  )
  returning id into v_id;
  perform set_config('app.allow_inquiry_change', '', true);
  return v_id;
end;
$$;
