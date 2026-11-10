-- Zawieszenie administratora. Zdejmuje stronę publiczną i chowa migawkę.
-- Przywrócenie wkłada tylko tę migawkę, nie szkic właściciela.
-- Nie wgrywać na DEV z tego środowiska. Po 20261110095345.
-- Pliki 20261110095119 i 20261110095124 są już na DEV. Ich SQL się nie zmienia.

alter type public.status_lokalu add value if not exists 'suspended';

create table public.zawieszona_publikacja (
  lokal_id uuid primary key references public.lokale (id) on delete cascade,
  nazwa text not null,
  slug text not null,
  typ public.typ_lokalu not null,
  opis text not null,
  adres text not null,
  kod text not null,
  miasto text not null,
  miasto_norm text not null,
  dzielnica text not null,
  lat numeric(9, 6),
  lng numeric(9, 6),
  telefon_publiczny text,
  zasady text[] not null,
  godziny_od time,
  godziny_do time,
  jeden_obiekt boolean not null,
  pojemnosc_max integer,
  cena_min_grosze integer,
  waluta text,
  jednostka_ceny public.jednostka_ceny,
  cena_na_zapytanie boolean not null default false,
  czy_przyklad boolean not null default false,
  opublikowano_o timestamptz not null,
  opublikowal_id uuid references public.profile (id)
);

create table public.zawieszone_sale (
  id uuid primary key,
  lokal_id uuid not null references public.zawieszona_publikacja (lokal_id) on delete cascade,
  nazwa text not null,
  opis_krotki text not null,
  pojemnosc_max smallint not null,
  jednostka public.jednostka_gosci not null,
  metraz smallint,
  kolejnosc smallint not null,
  waluta text not null,
  jednostka_ceny public.jednostka_ceny not null,
  kwota_grosze integer,
  cena_na_zapytanie boolean not null
);

create table public.zawieszone_zdjecia (
  id uuid primary key,
  lokal_id uuid not null references public.zawieszona_publikacja (lokal_id) on delete cascade,
  sala_id uuid,
  sciezka text not null,
  glowne boolean not null,
  kolejnosc smallint not null,
  podpis text,
  autor_licencja text
);

create table public.zawieszone_udogodnienia (
  lokal_id uuid not null references public.zawieszona_publikacja (lokal_id) on delete cascade,
  kod text not null references public.udogodnienia (kod),
  szczegol text,
  primary key (lokal_id, kod)
);

create table public.zawieszone_okazje (
  lokal_id uuid not null references public.zawieszona_publikacja (lokal_id) on delete cascade,
  kod text not null references public.okazje (kod),
  primary key (lokal_id, kod)
);

alter table public.zawieszona_publikacja enable row level security;
alter table public.zawieszona_publikacja force row level security;
alter table public.zawieszone_sale enable row level security;
alter table public.zawieszone_sale force row level security;
alter table public.zawieszone_zdjecia enable row level security;
alter table public.zawieszone_zdjecia force row level security;
alter table public.zawieszone_udogodnienia enable row level security;
alter table public.zawieszone_udogodnienia force row level security;
alter table public.zawieszone_okazje enable row level security;
alter table public.zawieszone_okazje force row level security;

revoke all on table public.zawieszona_publikacja from public, anon, authenticated;
revoke all on table public.zawieszone_sale from public, anon, authenticated;
revoke all on table public.zawieszone_zdjecia from public, anon, authenticated;
revoke all on table public.zawieszone_udogodnienia from public, anon, authenticated;
revoke all on table public.zawieszone_okazje from public, anon, authenticated;

create or replace function private.schowaj_migawke(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.zawieszona_publikacja where lokal_id = p_lokal) then
    raise exception 'Ten lokal ma już schowaną publikację.';
  end if;
  insert into public.zawieszona_publikacja (
    lokal_id, nazwa, slug, typ, opis, adres, kod, miasto, miasto_norm, dzielnica,
    lat, lng, telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt,
    pojemnosc_max, cena_min_grosze, waluta, jednostka_ceny, cena_na_zapytanie,
    czy_przyklad, opublikowano_o, opublikowal_id
  )
  select
    lokal_id, nazwa, slug, typ, opis, adres, kod, miasto, miasto_norm, dzielnica,
    lat, lng, telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt,
    pojemnosc_max, cena_min_grosze, waluta, jednostka_ceny, cena_na_zapytanie,
    czy_przyklad, opublikowano_o, opublikowal_id
  from public.lokal_publikacje
  where lokal_id = p_lokal;

  insert into public.zawieszone_sale (
    id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, kolejnosc,
    waluta, jednostka_ceny, kwota_grosze, cena_na_zapytanie
  )
  select
    id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, kolejnosc,
    waluta, jednostka_ceny, kwota_grosze, cena_na_zapytanie
  from public.opublikowane_sale
  where lokal_id = p_lokal;

  insert into public.zawieszone_zdjecia (
    id, lokal_id, sala_id, sciezka, glowne, kolejnosc, podpis, autor_licencja
  )
  select id, lokal_id, sala_id, sciezka, glowne, kolejnosc, podpis, autor_licencja
  from public.opublikowane_zdjecia
  where lokal_id = p_lokal;

  insert into public.zawieszone_udogodnienia (lokal_id, kod, szczegol)
  select lokal_id, kod, szczegol
  from public.opublikowane_udogodnienia
  where lokal_id = p_lokal;

  insert into public.zawieszone_okazje (lokal_id, kod)
  select lokal_id, kod
  from public.opublikowane_okazje
  where lokal_id = p_lokal;

  delete from public.lokal_publikacje where lokal_id = p_lokal;
end;
$$;

create or replace function private.odtworz_migawke(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.zawieszona_publikacja z
    join public.lokal_publikacje p
      on p.miasto_norm = z.miasto_norm
     and p.slug = z.slug
    where z.lokal_id = p_lokal
  ) then
    raise exception 'Ten adres strony zajął inny lokal. Przywrócenie nie podmienia cudzej strony.';
  end if;

  insert into public.lokal_publikacje (
    lokal_id, nazwa, slug, typ, opis, adres, kod, miasto, miasto_norm, dzielnica,
    lat, lng, telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt,
    pojemnosc_max, cena_min_grosze, waluta, jednostka_ceny, cena_na_zapytanie,
    czy_przyklad, opublikowano_o, opublikowal_id
  )
  select
    lokal_id, nazwa, slug, typ, opis, adres, kod, miasto, miasto_norm, dzielnica,
    lat, lng, telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt,
    pojemnosc_max, cena_min_grosze, waluta, jednostka_ceny, cena_na_zapytanie,
    czy_przyklad, opublikowano_o, opublikowal_id
  from public.zawieszona_publikacja
  where lokal_id = p_lokal;

  insert into public.opublikowane_sale (
    id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, kolejnosc,
    waluta, jednostka_ceny, kwota_grosze, cena_na_zapytanie
  )
  select
    id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, kolejnosc,
    waluta, jednostka_ceny, kwota_grosze, cena_na_zapytanie
  from public.zawieszone_sale
  where lokal_id = p_lokal;

  insert into public.opublikowane_zdjecia (
    id, lokal_id, sala_id, sciezka, glowne, kolejnosc, podpis, autor_licencja
  )
  select id, lokal_id, sala_id, sciezka, glowne, kolejnosc, podpis, autor_licencja
  from public.zawieszone_zdjecia
  where lokal_id = p_lokal;

  insert into public.opublikowane_udogodnienia (lokal_id, kod, szczegol)
  select lokal_id, kod, szczegol
  from public.zawieszone_udogodnienia
  where lokal_id = p_lokal;

  insert into public.opublikowane_okazje (lokal_id, kod)
  select lokal_id, kod
  from public.zawieszone_okazje
  where lokal_id = p_lokal;

  delete from public.zawieszona_publikacja where lokal_id = p_lokal;
end;
$$;

create or replace function private.zawies_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator zawiesza lokal.' using errcode = '42501';
  end if;
  select status::text into v_status from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.';
  end if;
  if v_status = 'suspended' then
    raise exception 'Ten lokal już jest zawieszony.';
  end if;
  if v_status = 'archived' then
    raise exception 'Wycofany lokal nie ma strony do zawieszenia.';
  end if;
  if not exists (select 1 from public.lokal_publikacje where lokal_id = p_lokal) then
    raise exception 'Nie ma opublikowanej wersji do zdjęcia. Szkic zostaje szkicem.';
  end if;
  perform private.schowaj_migawke(p_lokal);
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'suspended'
   where id = p_lokal;
  perform set_config('app.allow_status_change', '', true);
end;
$$;

create or replace function private.przywroc_zawieszony_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator przywraca zawieszony lokal.' using errcode = '42501';
  end if;
  select status::text into v_status from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.';
  end if;
  if v_status is distinct from 'suspended' then
    raise exception 'Przywrócenie dotyczy tylko lokalu zawieszonego przez administratora.';
  end if;
  if not exists (select 1 from public.zawieszona_publikacja where lokal_id = p_lokal) then
    raise exception 'Nie ma poprzedniej publikacji. Szkic nie wchodzi na stronę.';
  end if;
  perform private.odtworz_migawke(p_lokal);
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'published'
   where id = p_lokal;
  perform set_config('app.allow_status_change', '', true);
end;
$$;

create or replace function public.zawies_lokal(p_lokal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.zawies_lokal(p_lokal);
end;
$$;

create or replace function public.przywroc_zawieszony_lokal(p_lokal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.przywroc_zawieszony_lokal(p_lokal);
end;
$$;

create or replace function private.wycofaj_wlasny_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_lokal is null or not private.jest_wlascicielem_lokalu(p_lokal) then
    raise exception 'Ten lokal możesz wycofać tylko jako jego właściciel.' using errcode = '42501';
  end if;
  select status::text into v_status from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.' using errcode = '42501';
  end if;
  if v_status = 'suspended' then
    raise exception 'Zawieszenie administratora zdejmuje tylko administrator.' using errcode = '42501';
  end if;
  delete from public.lokal_publikacje where lokal_id = p_lokal;
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'archived',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false
   where id = p_lokal;
  perform set_config('app.allow_status_change', '', true);
end;
$$;

create or replace function private.archiwizuj_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator ukrywa lokal.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lokale where id = p_lokal) then
    raise exception 'Nie ma takiego lokalu.';
  end if;
  delete from public.zawieszona_publikacja where lokal_id = p_lokal;
  delete from public.lokal_publikacje where lokal_id = p_lokal;
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'archived',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false,
         sprawdzono_o = now(),
         sprawdzil_id = auth.uid()
   where id = p_lokal;
  perform set_config('app.allow_status_change', '', true);
end;
$$;

revoke all on function private.schowaj_migawke(uuid) from public, anon, authenticated, service_role;
revoke all on function private.odtworz_migawke(uuid) from public, anon, authenticated, service_role;
revoke all on function private.zawies_lokal(uuid) from public, anon, authenticated, service_role;
revoke all on function private.przywroc_zawieszony_lokal(uuid) from public, anon, authenticated, service_role;
revoke all on function public.zawies_lokal(uuid) from public, anon, authenticated, service_role;
revoke all on function public.przywroc_zawieszony_lokal(uuid) from public, anon, authenticated, service_role;

grant execute on function private.zawies_lokal(uuid) to authenticated;
grant execute on function private.przywroc_zawieszony_lokal(uuid) to authenticated;
grant execute on function public.zawies_lokal(uuid) to authenticated;
grant execute on function public.przywroc_zawieszony_lokal(uuid) to authenticated;
