-- Zapytania o termin. Nie stosować na DEV, dopóki operator nie wdroży
-- świadomie tej jednej, nowej wersji. Poprzednie migracje już są na DEV:
-- 20261107122010 i 20261110082734. Tej nie powtarzać po pierwszym zastosowaniu.
--
-- Brak rezerwacji, zadatku, kalendarza, pakietów, maili i SMS-ów.
-- Kolumny pakiet_id, wygasa_o i proponowany_termin celowo pominięte:
-- nie ma tabeli pakietów, a termin 24 h i zmiana daty nie są potwierdzone.
-- Status „zaakceptowane” istnieje w typie, ale żadna funkcja go nie ustawia.

create type public.status_zapytania as enum (
  'nowe',
  'inny_termin',
  'odrzucone',
  'wygasle',
  'zaakceptowane'
);

create table public.zapytania (
  id uuid primary key default gen_random_uuid(),
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  sala_id uuid not null references public.sale (id),
  klient_id uuid references public.profile (id) on delete set null,
  okazja_kod text references public.okazje (kod),
  data date not null,
  godzina_od time not null,
  liczba_gosci integer not null,
  imie_nazwisko text not null,
  telefon text not null,
  email text not null,
  wiadomosc text,
  status public.status_zapytania not null default 'nowe',
  kwota_szacunkowa integer,
  waluta char(3) not null default 'PLN',
  zrodlo text not null default 'strona_lokalu',
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint zapytania_goscie check (liczba_gosci between 1 and 5000),
  constraint zapytania_imie check (char_length(imie_nazwisko) between 2 and 120),
  constraint zapytania_telefon check (char_length(telefon) between 7 and 32),
  constraint zapytania_email check (char_length(email) between 5 and 200),
  constraint zapytania_wiadomosc check (wiadomosc is null or char_length(wiadomosc) <= 2000),
  constraint zapytania_kwota check (kwota_szacunkowa is null or kwota_szacunkowa >= 0),
  constraint zapytania_zrodlo check (zrodlo = 'strona_lokalu')
);

comment on table public.zapytania is
  'Zapytanie o termin. Nie jest rezerwacją. Gość nie czyta wierszy. Konto widzi tylko wiersze z klient_id = auth.uid(), nigdy po samym e-mailu.';

create index zapytania_lokal_utworzono on public.zapytania (lokal_id, utworzono desc);
create index zapytania_klient on public.zapytania (klient_id) where klient_id is not null;
create index zapytania_email_czas on public.zapytania (lower(email), utworzono desc);

alter table public.zapytania enable row level security;
alter table public.zapytania force row level security;

create or replace function private.pilnuj_zapytania()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.allow_inquiry_change', true) is distinct from '1' then
    raise exception 'Zapytanie zmienia tylko serwerowa funkcja wysyłki albo odpowiedzi.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger zapytania_tylko_funkcja
  before insert or update on public.zapytania
  for each row execute function private.pilnuj_zapytania();

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

  -- Limit nadużyć, nie reguła biznesowa. Licznik jest w funkcji, bo gość
  -- nie ma prawa czytać tabeli.
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

comment on function private.wyslij_zapytanie(uuid, uuid, text, date, time, integer, text, text, text, text) is
  'Zapisuje zapytanie. klient_id bierze wyłącznie z auth.uid(). Cena, status i właściciel nie są parametrami.';

create or replace function private.odrzuc_zapytanie(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lokal uuid;
begin
  if auth.uid() is null then
    raise exception 'Zaloguj się.' using errcode = '42501';
  end if;
  select z.lokal_id into v_lokal
  from public.zapytania z
  where z.id = p_id
    and z.status = 'nowe'
    and (private.jest_admin() or private.jest_wlascicielem_lokalu(z.lokal_id));
  if not found then
    raise exception 'Nie możesz odrzucić tego zapytania.' using errcode = '42501';
  end if;
  perform set_config('app.allow_inquiry_change', '1', true);
  update public.zapytania
     set status = 'odrzucone',
         zmieniono = now()
   where id = p_id
     and status = 'nowe';
  perform set_config('app.allow_inquiry_change', '', true);
end;
$$;

comment on function private.odrzuc_zapytanie(uuid) is
  'Jedyna odpowiedź właściciela w tym etapie: nowe → odrzucone. Nie tworzy rezerwacji.';

create or replace function public.wyslij_zapytanie(
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
security invoker
set search_path = ''
as $$
begin
  return private.wyslij_zapytanie(
    p_lokal, p_sala, p_okazja, p_data, p_godzina, p_goscie,
    p_imie, p_telefon, p_email, p_wiadomosc
  );
end;
$$;

create or replace function public.odrzuc_zapytanie(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.odrzuc_zapytanie(p_id);
end;
$$;

revoke all on function private.pilnuj_zapytania() from public, anon, authenticated, service_role;

revoke all on function private.wyslij_zapytanie(uuid, uuid, text, date, time, integer, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.odrzuc_zapytanie(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.wyslij_zapytanie(uuid, uuid, text, date, time, integer, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.odrzuc_zapytanie(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.wyslij_zapytanie(uuid, uuid, text, date, time, integer, text, text, text, text)
  to anon, authenticated;
grant execute on function public.wyslij_zapytanie(uuid, uuid, text, date, time, integer, text, text, text, text)
  to anon, authenticated;
grant execute on function private.odrzuc_zapytanie(uuid) to authenticated;
grant execute on function public.odrzuc_zapytanie(uuid) to authenticated;

revoke all on table public.zapytania from public, anon, authenticated;
grant select on table public.zapytania to authenticated;

create policy zapytania_czytaj on public.zapytania
  for select to authenticated
  using (
    (klient_id is not null and klient_id = auth.uid())
    or private.jest_admin()
    or private.jest_czlonkiem(lokal_id)
  );

-- Brak polityk insert, update i delete. Zapis idzie przez funkcję.
