-- rezerwujmiejsce.pl — pierwszy wycinek: lokale, weryfikacja, publiczny odczyt.
-- Kwoty w groszach. Rola platformy nie pochodzi z user_metadata (użytkownik może je sam zmienić).
-- Schemat private nie jest wystawiony w API. Publikację zapisuje tylko funkcja administratora.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, supabase_auth_admin, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Typy
-- ---------------------------------------------------------------------------

create type public.rola_uzytkownika as enum ('klient', 'wlasciciel', 'admin');
create type public.rola_czlonka as enum ('wlasciciel', 'manager');
create type public.status_lokalu as enum (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived'
);
create type public.status_zgloszenia as enum ('none', 'pending_review', 'rejected');
create type public.typ_lokalu as enum (
  'restauracja',
  'bawialnia',
  'sala_bankietowa',
  'kawiarnia',
  'dworek',
  'klub',
  'inne'
);
create type public.jednostka_gosci as enum ('osoby', 'dzieci');
create type public.jednostka_ceny as enum (
  'za_osobe',
  'za_sale',
  'za_pakiet',
  'za_godzine',
  'za_dzien'
);

-- ---------------------------------------------------------------------------
-- Pomocnicze, niemutowalne
-- ---------------------------------------------------------------------------

create or replace function private.zloz_tekst(t text)
returns text
language sql
immutable
as $$
  select lower(translate(coalesce(t, ''),
    'ĄĆĘŁŃÓŚŹŻąćęłńóśźż',
    'ACELNOSZZacelnoszz'));
$$;

create or replace function private.zloz_miasto(t text)
returns text
language sql
immutable
as $$
  select trim(private.zloz_tekst(t));
$$;

create or replace function private.slugify(t text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(private.zloz_tekst(t), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function private.uuid_albo_null(t text)
returns uuid
language sql
immutable
as $$
  select case
    when t ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid
    else null
  end;
$$;

create or replace function private.dotknij()
returns trigger
language plpgsql
as $$
begin
  new.zmieniono := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabele robocze (niewidoczne dla gościa)
-- ---------------------------------------------------------------------------

create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  rola public.rola_uzytkownika not null default 'klient',
  imie_nazwisko text,
  telefon text,
  email text,
  zgody_marketing boolean not null default false,
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint profile_imie_dl check (imie_nazwisko is null or char_length(imie_nazwisko) <= 160),
  constraint profile_telefon_dl check (telefon is null or char_length(telefon) <= 40)
);

create unique index profile_email_lower on public.profile (lower(email)) where email is not null;

create table public.lokale (
  id uuid primary key default gen_random_uuid(),
  wlasciciel_id uuid not null references public.profile (id),
  nazwa text not null default '',
  slug text not null default '',
  typ public.typ_lokalu not null default 'inne',
  opis text not null default '',
  adres text not null default '',
  kod text not null default '',
  miasto text not null default 'Zielona Góra',
  miasto_norm text not null default '',
  dzielnica text not null default '',
  lat numeric(9, 6),
  lng numeric(9, 6),
  telefon_publiczny text,
  zasady text[] not null default '{}',
  godziny_od time,
  godziny_do time,
  jeden_obiekt boolean not null default true,
  status public.status_lokalu not null default 'draft',
  status_zgloszenia public.status_zgloszenia not null default 'none',
  powod_odrzucenia text,
  ma_nieopublikowane_zmiany boolean not null default false,
  czy_przyklad boolean not null default false,
  wyslano_o timestamptz,
  sprawdzono_o timestamptz,
  sprawdzil_id uuid references public.profile (id),
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint lokale_nazwa_dl check (char_length(nazwa) <= 120),
  constraint lokale_opis_dl check (char_length(opis) <= 8000),
  constraint lokale_slug_format check (slug = '' or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint lokale_lat check (lat is null or (lat >= -90 and lat <= 90)),
  constraint lokale_lng check (lng is null or (lng >= -180 and lng <= 180)),
  constraint lokale_zasady_ile check (cardinality(zasady) <= 40),
  constraint lokale_telefon_dl check (telefon_publiczny is null or char_length(telefon_publiczny) <= 40)
);

create unique index lokale_slug_miasto on public.lokale (miasto_norm, slug) where slug <> '';
create index lokale_wlasciciel on public.lokale (wlasciciel_id);
create index lokale_status on public.lokale (status, status_zgloszenia);

create table public.lokal_czlonkowie (
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  profil_id uuid not null references public.profile (id) on delete cascade,
  rola public.rola_czlonka not null,
  utworzono timestamptz not null default now(),
  primary key (lokal_id, profil_id)
);

create index lokal_czlonkowie_profil on public.lokal_czlonkowie (profil_id);

create table public.lokal_dane_prywatne (
  lokal_id uuid primary key references public.lokale (id) on delete cascade,
  email_kontaktowy text,
  telefon_wewnetrzny text,
  notatka text,
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint prywatne_email_dl check (email_kontaktowy is null or char_length(email_kontaktowy) <= 200),
  constraint prywatne_tel_dl check (telefon_wewnetrzny is null or char_length(telefon_wewnetrzny) <= 40),
  constraint prywatne_notatka_dl check (notatka is null or char_length(notatka) <= 4000)
);

comment on table public.lokal_dane_prywatne is
  'Kontakt i notatka biznesowa. Nie trafiają do publikacji. IBAN i faktury są poza tym wycinkiem.';

create table public.sale (
  id uuid primary key default gen_random_uuid(),
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  nazwa text not null default '',
  opis_krotki text not null default '',
  pojemnosc_max smallint,
  jednostka public.jednostka_gosci not null default 'osoby',
  metraz smallint,
  widoczna boolean not null default true,
  kolejnosc smallint not null default 0,
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint sale_nazwa_dl check (char_length(nazwa) <= 120),
  constraint sale_opis_dl check (char_length(opis_krotki) <= 500),
  constraint sale_pojemnosc check (pojemnosc_max is null or pojemnosc_max between 1 and 5000),
  constraint sale_metraz check (metraz is null or metraz between 1 and 20000)
);

create index sale_lokal on public.sale (lokal_id);

create table public.ceny_sal (
  sala_id uuid primary key references public.sale (id) on delete cascade,
  waluta text not null default 'PLN',
  jednostka public.jednostka_ceny not null default 'za_sale',
  kwota_grosze integer,
  cena_na_zapytanie boolean not null default false,
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint ceny_waluta check (waluta ~ '^[A-Z]{3}$'),
  constraint ceny_sens check (
    (cena_na_zapytanie and kwota_grosze is null)
    or (not cena_na_zapytanie and kwota_grosze is not null and kwota_grosze >= 0 and kwota_grosze <= 100000000)
  )
);

create table public.zdjecia (
  id uuid primary key default gen_random_uuid(),
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  sala_id uuid references public.sale (id) on delete set null,
  sciezka text not null,
  glowne boolean not null default false,
  kolejnosc smallint not null default 0,
  podpis text,
  autor_licencja text,
  mime text not null,
  rozmiar_bajty integer not null,
  utworzono timestamptz not null default now(),
  zmieniono timestamptz not null default now(),
  constraint zdjecia_sciezka check (
    sciezka ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  ),
  constraint zdjecia_prefix check (split_part(sciezka, '/', 1) = lokal_id::text),
  constraint zdjecia_plik check (split_part(sciezka, '/', 2) like id::text || '.%'),
  constraint zdjecia_mime check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  constraint zdjecia_rozmiar check (rozmiar_bajty > 0 and rozmiar_bajty <= 8000000),
  constraint zdjecia_podpis_dl check (podpis is null or char_length(podpis) <= 200),
  constraint zdjecia_licencja_dl check (autor_licencja is null or char_length(autor_licencja) <= 300)
);

create unique index zdjecia_sciezka on public.zdjecia (sciezka);
create unique index zdjecia_jedno_glowne on public.zdjecia (lokal_id) where glowne;
create index zdjecia_lokal on public.zdjecia (lokal_id);

create table public.udogodnienia (
  kod text primary key,
  nazwa text not null,
  filtr boolean not null default true,
  kolejnosc smallint not null default 0,
  constraint udogodnienia_kod check (kod ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.lokal_udogodnienia (
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  kod text not null references public.udogodnienia (kod),
  szczegol text,
  primary key (lokal_id, kod),
  constraint udogodnienie_szczegol_dl check (szczegol is null or char_length(szczegol) <= 120)
);

create table public.okazje (
  kod text primary key,
  nazwa text not null,
  nazwa_kafla text not null,
  zdjecie text,
  kolejnosc smallint not null default 0,
  constraint okazje_kod check (kod ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.lokal_okazje (
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  kod text not null references public.okazje (kod),
  primary key (lokal_id, kod)
);

-- ---------------------------------------------------------------------------
-- Migawka publiczna. Zapisuje ją wyłącznie zatwierdz_lokal.
-- ---------------------------------------------------------------------------

create table public.lokal_publikacje (
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
  opublikowano_o timestamptz not null default now(),
  opublikowal_id uuid references public.profile (id),
  unique (miasto_norm, slug)
);

create index lokal_publikacje_miasto on public.lokal_publikacje (miasto_norm);

create table public.opublikowane_sale (
  id uuid primary key,
  lokal_id uuid not null references public.lokal_publikacje (lokal_id) on delete cascade,
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

create index opublikowane_sale_lokal on public.opublikowane_sale (lokal_id);

create table public.opublikowane_zdjecia (
  id uuid primary key,
  lokal_id uuid not null references public.lokal_publikacje (lokal_id) on delete cascade,
  sala_id uuid,
  sciezka text not null unique,
  glowne boolean not null,
  kolejnosc smallint not null,
  podpis text,
  autor_licencja text
);

create index opublikowane_zdjecia_lokal on public.opublikowane_zdjecia (lokal_id);

create table public.opublikowane_udogodnienia (
  lokal_id uuid not null references public.lokal_publikacje (lokal_id) on delete cascade,
  kod text not null references public.udogodnienia (kod),
  szczegol text,
  primary key (lokal_id, kod)
);

create table public.opublikowane_okazje (
  lokal_id uuid not null references public.lokal_publikacje (lokal_id) on delete cascade,
  kod text not null references public.okazje (kod),
  primary key (lokal_id, kod)
);

-- ---------------------------------------------------------------------------
-- Autoryzacja wierszy
-- ---------------------------------------------------------------------------

create or replace function private.jest_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile p
    where p.id = auth.uid()
      and p.rola = 'admin'
  );
$$;

create or replace function private.jest_czlonkiem(p_lokal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lokal_czlonkowie c
    where c.lokal_id = p_lokal
      and c.profil_id = auth.uid()
  );
$$;

create or replace function private.jest_wlascicielem_lokalu(p_lokal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lokal_czlonkowie c
    where c.lokal_id = p_lokal
      and c.profil_id = auth.uid()
      and c.rola = 'wlasciciel'
  );
$$;

revoke all on function private.jest_admin() from public;
revoke all on function private.jest_czlonkiem(uuid) from public;
revoke all on function private.jest_wlascicielem_lokalu(uuid) from public;
revoke all on function private.zloz_tekst(text) from public;
revoke all on function private.zloz_miasto(text) from public;
revoke all on function private.slugify(text) from public;
revoke all on function private.uuid_albo_null(text) from public;

grant execute on function private.jest_admin() to anon, authenticated, service_role;
grant execute on function private.jest_czlonkiem(uuid) to anon, authenticated, service_role;
grant execute on function private.jest_wlascicielem_lokalu(uuid) to authenticated, service_role;
grant execute on function private.zloz_tekst(text) to anon, authenticated, service_role;
grant execute on function private.zloz_miasto(text) to anon, authenticated, service_role;
grant execute on function private.slugify(text) to anon, authenticated, service_role;
grant execute on function private.uuid_albo_null(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggery
-- ---------------------------------------------------------------------------

create or replace function private.utworz_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, email, rola, imie_nazwisko)
  values (
    new.id,
    new.email,
    'klient',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'imie_nazwisko', '')), '')
  );
  return new;
end;
$$;

create trigger utworz_profil_po_rejestracji
  after insert on auth.users
  for each row execute function private.utworz_profil();

create or replace function private.synchronizuj_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.allow_email_sync', '1', true);
  update public.profile
     set email = new.email
   where id = new.id
     and email is distinct from new.email;
  return new;
end;
$$;

create trigger synchronizuj_email_profilu
  after update of email on auth.users
  for each row execute function private.synchronizuj_email();

create or replace function private.pilnuj_profilu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.rola is distinct from old.rola
       and current_setting('app.allow_role_change', true) is distinct from '1' then
      raise exception 'Roli nie można zmienić samodzielnie.' using errcode = '42501';
    end if;
    if new.email is distinct from old.email
       and current_setting('app.allow_email_sync', true) is distinct from '1' then
      raise exception 'Adres e-mail konta zmienia się przy logowaniu, nie w formularzu lokalu.' using errcode = '42501';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Identyfikatora profilu nie zmienisz.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger pilnuj_profilu
  before update on public.profile
  for each row execute function private.pilnuj_profilu();

create trigger profil_zmieniono
  before update on public.profile
  for each row execute function private.dotknij();

create or replace function private.uzupelnij_miasto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.miasto is null or trim(new.miasto) = '' then
    new.miasto := 'Zielona Góra';
  end if;
  new.miasto_norm := private.zloz_miasto(new.miasto);
  if tg_op = 'INSERT' and new.czy_przyklad and session_user not in ('postgres', 'supabase_admin') then
    new.czy_przyklad := false;
  end if;
  if tg_op = 'UPDATE'
     and new.czy_przyklad is distinct from old.czy_przyklad
     and session_user not in ('postgres', 'supabase_admin')
     and current_setting('app.allow_status_change', true) is distinct from '1' then
    raise exception 'Oznaczenia danych przykładowych nie zmienisz z konta.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger lokale_miasto
  before insert or update on public.lokale
  for each row execute function private.uzupelnij_miasto();

create or replace function private.pilnuj_statusu_lokalu()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if current_setting('app.allow_status_change', true) is distinct from '1' then
    if new.status is distinct from old.status
       or new.status_zgloszenia is distinct from old.status_zgloszenia
       or new.sprawdzil_id is distinct from old.sprawdzil_id
       or new.sprawdzono_o is distinct from old.sprawdzono_o
       or new.wyslano_o is distinct from old.wyslano_o
       or new.wlasciciel_id is distinct from old.wlasciciel_id
       or new.powod_odrzucenia is distinct from old.powod_odrzucenia
    then
      raise exception 'Te pola zmienia tylko weryfikacja, nie formularz.' using errcode = '42501';
    end if;
    if old.ma_nieopublikowane_zmiany and not new.ma_nieopublikowane_zmiany then
      raise exception 'Nie można samemu schować informacji o nieopublikowanych zmianach.' using errcode = '42501';
    end if;
  end if;

  if current_setting('app.allow_status_change', true) is distinct from '1'
     and exists (select 1 from public.lokal_publikacje p where p.lokal_id = new.id)
     and (
       new.nazwa is distinct from old.nazwa
       or new.slug is distinct from old.slug
       or new.typ is distinct from old.typ
       or new.opis is distinct from old.opis
       or new.adres is distinct from old.adres
       or new.kod is distinct from old.kod
       or new.miasto is distinct from old.miasto
       or new.dzielnica is distinct from old.dzielnica
       or new.lat is distinct from old.lat
       or new.lng is distinct from old.lng
       or new.telefon_publiczny is distinct from old.telefon_publiczny
       or new.zasady is distinct from old.zasady
       or new.godziny_od is distinct from old.godziny_od
       or new.godziny_do is distinct from old.godziny_do
       or new.jeden_obiekt is distinct from old.jeden_obiekt
     )
  then
    new.ma_nieopublikowane_zmiany := true;
  end if;

  return new;
end;
$$;

create trigger lokale_status
  before update on public.lokale
  for each row execute function private.pilnuj_statusu_lokalu();

create trigger lokale_zmieniono
  before update on public.lokale
  for each row execute function private.dotknij();

create or replace function private.oznacz_zmiany_lokalu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lokal uuid;
begin
  if tg_table_name = 'ceny_sal' then
    select s.lokal_id into v_lokal
    from public.sale s
    where s.id = coalesce(new.sala_id, old.sala_id);
  else
    v_lokal := coalesce(new.lokal_id, old.lokal_id);
  end if;

  update public.lokale l
     set ma_nieopublikowane_zmiany = true
   where l.id = v_lokal
     and l.ma_nieopublikowane_zmiany = false
     and exists (select 1 from public.lokal_publikacje p where p.lokal_id = l.id);

  return coalesce(new, old);
end;
$$;

create trigger sale_zmiany
  after insert or update or delete on public.sale
  for each row execute function private.oznacz_zmiany_lokalu();
create trigger ceny_zmiany
  after insert or update or delete on public.ceny_sal
  for each row execute function private.oznacz_zmiany_lokalu();
create trigger zdjecia_zmiany
  after insert or update or delete on public.zdjecia
  for each row execute function private.oznacz_zmiany_lokalu();
create trigger udogodnienia_zmiany
  after insert or update or delete on public.lokal_udogodnienia
  for each row execute function private.oznacz_zmiany_lokalu();
create trigger okazje_zmiany
  after insert or update or delete on public.lokal_okazje
  for each row execute function private.oznacz_zmiany_lokalu();

create trigger sale_zmieniono before update on public.sale
  for each row execute function private.dotknij();
create trigger ceny_zmieniono before update on public.ceny_sal
  for each row execute function private.dotknij();
create trigger zdjecia_zmieniono before update on public.zdjecia
  for each row execute function private.dotknij();
create trigger prywatne_zmieniono before update on public.lokal_dane_prywatne
  for each row execute function private.dotknij();

create or replace function private.jedno_zdjecie_glowne()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sala_id is not null and not exists (
    select 1 from public.sale s
    where s.id = new.sala_id and s.lokal_id = new.lokal_id
  ) then
    raise exception 'Sala nie należy do tego lokalu.';
  end if;
  if new.glowne then
    update public.zdjecia
       set glowne = false
     where lokal_id = new.lokal_id
       and id <> new.id
       and glowne;
  end if;
  return new;
end;
$$;

create trigger zdjecia_glowne
  before insert or update on public.zdjecia
  for each row execute function private.jedno_zdjecie_glowne();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profile enable row level security;
alter table public.lokale enable row level security;
alter table public.lokal_czlonkowie enable row level security;
alter table public.lokal_dane_prywatne enable row level security;
alter table public.sale enable row level security;
alter table public.ceny_sal enable row level security;
alter table public.zdjecia enable row level security;
alter table public.udogodnienia enable row level security;
alter table public.lokal_udogodnienia enable row level security;
alter table public.okazje enable row level security;
alter table public.lokal_okazje enable row level security;
alter table public.lokal_publikacje enable row level security;
alter table public.opublikowane_sale enable row level security;
alter table public.opublikowane_zdjecia enable row level security;
alter table public.opublikowane_udogodnienia enable row level security;
alter table public.opublikowane_okazje enable row level security;

alter table public.profile force row level security;
alter table public.lokale force row level security;
alter table public.lokal_czlonkowie force row level security;
alter table public.lokal_dane_prywatne force row level security;
alter table public.sale force row level security;
alter table public.ceny_sal force row level security;
alter table public.zdjecia force row level security;
alter table public.udogodnienia force row level security;
alter table public.lokal_udogodnienia force row level security;
alter table public.okazje force row level security;
alter table public.lokal_okazje force row level security;
alter table public.lokal_publikacje force row level security;
alter table public.opublikowane_sale force row level security;
alter table public.opublikowane_zdjecia force row level security;
alter table public.opublikowane_udogodnienia force row level security;
alter table public.opublikowane_okazje force row level security;

create policy profile_czytaj on public.profile
  for select to authenticated
  using (id = auth.uid() or private.jest_admin());

create policy profile_zmien on public.profile
  for update to authenticated
  using (id = auth.uid() or private.jest_admin())
  with check (id = auth.uid() or private.jest_admin());

create policy lokale_czytaj on public.lokale
  for select to authenticated
  using (private.jest_czlonkiem(id) or private.jest_admin());

create policy lokale_zmien on public.lokale
  for update to authenticated
  using (private.jest_czlonkiem(id) or private.jest_admin())
  with check (private.jest_czlonkiem(id) or private.jest_admin());

create policy czlonkowie_czytaj on public.lokal_czlonkowie
  for select to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy prywatne_czytaj on public.lokal_dane_prywatne
  for select to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy prywatne_zmien on public.lokal_dane_prywatne
  for update to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin())
  with check (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy sale_zarzadzaj on public.sale
  for all to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin())
  with check (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy ceny_zarzadzaj on public.ceny_sal
  for all to authenticated
  using (
    exists (
      select 1 from public.sale s
      where s.id = sala_id
        and (private.jest_czlonkiem(s.lokal_id) or private.jest_admin())
    )
  )
  with check (
    exists (
      select 1 from public.sale s
      where s.id = sala_id
        and (private.jest_czlonkiem(s.lokal_id) or private.jest_admin())
    )
  );

create policy zdjecia_zarzadzaj on public.zdjecia
  for all to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin())
  with check (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy udogodnienia_czytaj on public.udogodnienia
  for select to anon, authenticated
  using (true);

create policy udogodnienia_admin on public.udogodnienia
  for all to authenticated
  using (private.jest_admin())
  with check (private.jest_admin());

create policy lokal_udogodnienia_zarzadzaj on public.lokal_udogodnienia
  for all to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin())
  with check (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy okazje_czytaj on public.okazje
  for select to anon, authenticated
  using (true);

create policy okazje_admin on public.okazje
  for all to authenticated
  using (private.jest_admin())
  with check (private.jest_admin());

create policy lokal_okazje_zarzadzaj on public.lokal_okazje
  for all to authenticated
  using (private.jest_czlonkiem(lokal_id) or private.jest_admin())
  with check (private.jest_czlonkiem(lokal_id) or private.jest_admin());

create policy publikacje_czytaj on public.lokal_publikacje
  for select to anon, authenticated
  using (true);

create policy opub_sale_czytaj on public.opublikowane_sale
  for select to anon, authenticated
  using (true);

create policy opub_zdjecia_czytaj on public.opublikowane_zdjecia
  for select to anon, authenticated
  using (true);

create policy opub_udogodnienia_czytaj on public.opublikowane_udogodnienia
  for select to anon, authenticated
  using (true);

create policy opub_okazje_czytaj on public.opublikowane_okazje
  for select to anon, authenticated
  using (true);

revoke all on all tables in schema public from anon, authenticated;

grant select, update (imie_nazwisko, telefon, zgody_marketing, zmieniono) on public.profile to authenticated;

grant select, update on public.lokale to authenticated;
grant select on public.lokal_czlonkowie to authenticated;
grant select, update on public.lokal_dane_prywatne to authenticated;
grant select, insert, update, delete on public.sale to authenticated;
grant select, insert, update, delete on public.ceny_sal to authenticated;
grant select, insert, update, delete on public.zdjecia to authenticated;
grant select on public.udogodnienia to anon, authenticated;
grant select, insert, update, delete on public.lokal_udogodnienia to authenticated;
grant select on public.okazje to anon, authenticated;
grant select, insert, update, delete on public.lokal_okazje to authenticated;
grant select on public.lokal_publikacje to anon, authenticated;
grant select on public.opublikowane_sale to anon, authenticated;
grant select on public.opublikowane_zdjecia to anon, authenticated;
grant select on public.opublikowane_udogodnienia to anon, authenticated;
grant select on public.opublikowane_okazje to anon, authenticated;

-- Administrator słownika korzysta z polityk FOR ALL, więc potrzebuje zapisu.
grant insert, update, delete on public.udogodnienia to authenticated;
grant insert, update, delete on public.okazje to authenticated;

-- ---------------------------------------------------------------------------
-- Operacje
-- ---------------------------------------------------------------------------

create or replace function private.waliduj_do_wyslania(p_lokal uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.lokale%rowtype;
  errs text[] := '{}';
begin
  select * into v from public.lokale where id = p_lokal;
  if not found then
    return array['Nie ma takiego lokalu.'];
  end if;
  if char_length(trim(v.nazwa)) < 2 then
    errs := errs || 'Podaj nazwę lokalu (przynajmniej 2 znaki).';
  end if;
  if char_length(trim(v.miasto)) < 2 then
    errs := errs || 'Podaj miasto.';
  end if;
  if v.slug = '' then
    errs := errs || 'Brak końcówki adresu strony. Zapisz lokal jeszcze raz.';
  end if;
  if not exists (
    select 1 from public.sale s
    where s.lokal_id = p_lokal
      and s.widoczna
      and s.pojemnosc_max is not null
      and char_length(trim(s.nazwa)) >= 1
  ) then
    errs := errs || 'Dodaj przynajmniej jedną widoczną salę z nazwą i liczbą gości. Lokal bez podziału na sale też ma jedną salę — cały lokal.';
  end if;
  if exists (
    select 1
    from public.sale s
    where s.lokal_id = p_lokal
      and s.widoczna
      and not exists (select 1 from public.ceny_sal c where c.sala_id = s.id)
  ) then
    errs := errs || 'Każda widoczna sala potrzebuje kwoty albo oznaczenia „cena na zapytanie”.';
  end if;
  return errs;
end;
$$;

create or replace function private.skopiuj_publikacje(p_lokal uuid, p_admin uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lokale%rowtype;
  v_min integer;
  v_por boolean;
  v_unit public.jednostka_ceny;
  v_waluta text;
  v_cap integer;
begin
  select * into v from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.';
  end if;

  if exists (
    select 1 from public.lokal_publikacje p
    where p.miasto_norm = v.miasto_norm
      and p.slug = v.slug
      and p.lokal_id <> v.id
  ) then
    raise exception 'Ten adres strony jest już zajęty przez inny opublikowany lokal. Zmień końcówkę adresu.';
  end if;

  delete from public.lokal_publikacje where lokal_id = p_lokal;

  select
    min(c.kwota_grosze) filter (where not c.cena_na_zapytanie),
    bool_or(c.cena_na_zapytanie),
    max(s.pojemnosc_max),
    (array_agg(c.jednostka order by c.kwota_grosze asc nulls last))[1],
    (array_agg(c.waluta order by c.kwota_grosze asc nulls last))[1]
  into v_min, v_por, v_cap, v_unit, v_waluta
  from public.sale s
  join public.ceny_sal c on c.sala_id = s.id
  where s.lokal_id = p_lokal
    and s.widoczna
    and s.pojemnosc_max is not null;

  insert into public.lokal_publikacje (
    lokal_id, nazwa, slug, typ, opis, adres, kod, miasto, miasto_norm, dzielnica,
    lat, lng, telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt,
    pojemnosc_max, cena_min_grosze, waluta, jednostka_ceny, cena_na_zapytanie,
    czy_przyklad, opublikowano_o, opublikowal_id
  ) values (
    v.id, v.nazwa, v.slug, v.typ, v.opis, v.adres, v.kod, v.miasto, v.miasto_norm, v.dzielnica,
    v.lat, v.lng, v.telefon_publiczny, v.zasady, v.godziny_od, v.godziny_do, v.jeden_obiekt,
    v_cap, v_min, v_waluta, v_unit, coalesce(v_por, false),
    v.czy_przyklad, now(), p_admin
  );

  insert into public.opublikowane_sale (
    id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, kolejnosc,
    waluta, jednostka_ceny, kwota_grosze, cena_na_zapytanie
  )
  select
    s.id, s.lokal_id, s.nazwa, s.opis_krotki, s.pojemnosc_max, s.jednostka, s.metraz, s.kolejnosc,
    c.waluta, c.jednostka, c.kwota_grosze, c.cena_na_zapytanie
  from public.sale s
  join public.ceny_sal c on c.sala_id = s.id
  where s.lokal_id = p_lokal
    and s.widoczna
    and s.pojemnosc_max is not null
    and char_length(trim(s.nazwa)) >= 1;

  insert into public.opublikowane_zdjecia (
    id, lokal_id, sala_id, sciezka, glowne, kolejnosc, podpis, autor_licencja
  )
  select z.id, z.lokal_id, z.sala_id, z.sciezka, z.glowne, z.kolejnosc, z.podpis, z.autor_licencja
  from public.zdjecia z
  where z.lokal_id = p_lokal;

  insert into public.opublikowane_udogodnienia (lokal_id, kod, szczegol)
  select u.lokal_id, u.kod, u.szczegol
  from public.lokal_udogodnienia u
  where u.lokal_id = p_lokal;

  insert into public.opublikowane_okazje (lokal_id, kod)
  select o.lokal_id, o.kod
  from public.lokal_okazje o
  where o.lokal_id = p_lokal;
end;
$$;

create or replace function public.zostan_wlascicielem()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rola public.rola_uzytkownika;
begin
  if auth.uid() is null then
    raise exception 'Zaloguj się, żeby prowadzić lokal.';
  end if;
  select rola into v_rola from public.profile where id = auth.uid();
  if v_rola is null then
    raise exception 'Brak profilu. Wyloguj się i zaloguj ponownie.';
  end if;
  if v_rola = 'admin' or v_rola = 'wlasciciel' then
    return;
  end if;
  perform set_config('app.allow_role_change', '1', true);
  update public.profile
     set rola = 'wlasciciel'
   where id = auth.uid()
     and rola = 'klient';
end;
$$;

create or replace function public.utworz_lokal(p_nazwa text default '', p_miasto text default 'Zielona Góra')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text;
  v_miasto text;
  v_norm text;
  v_n int := 2;
  v_base text;
begin
  if auth.uid() is null then
    raise exception 'Zaloguj się, żeby dodać lokal.';
  end if;
  perform public.zostan_wlascicielem();
  v_miasto := coalesce(nullif(trim(p_miasto), ''), 'Zielona Góra');
  v_norm := private.zloz_miasto(v_miasto);
  v_base := private.slugify(coalesce(p_nazwa, ''));
  if v_base = '' then
    v_base := 'lokal';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.lokale l where l.miasto_norm = v_norm and l.slug = v_slug) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  insert into public.lokale (wlasciciel_id, nazwa, miasto, slug)
  values (auth.uid(), coalesce(trim(p_nazwa), ''), v_miasto, v_slug)
  returning id into v_id;

  insert into public.lokal_czlonkowie (lokal_id, profil_id, rola)
  values (v_id, auth.uid(), 'wlasciciel');

  insert into public.lokal_dane_prywatne (lokal_id) values (v_id);

  insert into public.sale (lokal_id, nazwa, kolejnosc)
  values (v_id, 'Cały lokal', 0);

  return v_id;
end;
$$;

create or replace function public.wyslij_do_weryfikacji(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lokale%rowtype;
  errs text[];
  v_slug text;
  v_n int := 2;
  v_base text;
begin
  if auth.uid() is null then
    raise exception 'Zaloguj się.';
  end if;
  if not (private.jest_czlonkiem(p_lokal) or private.jest_admin()) then
    raise exception 'Nie masz dostępu do tego lokalu.' using errcode = '42501';
  end if;

  select * into v from public.lokale where id = p_lokal;
  if v.slug = '' then
    v_base := private.slugify(v.nazwa);
    if v_base = '' then
      v_base := 'lokal';
    end if;
    v_slug := v_base;
    while exists (
      select 1 from public.lokale l
      where l.miasto_norm = v.miasto_norm and l.slug = v_slug and l.id <> p_lokal
    ) loop
      v_slug := v_base || '-' || v_n;
      v_n := v_n + 1;
    end loop;
    update public.lokale set slug = v_slug where id = p_lokal;
  end if;

  errs := private.waliduj_do_wyslania(p_lokal);
  if coalesce(array_length(errs, 1), 0) > 0 then
    raise exception '%', array_to_string(errs, ' ');
  end if;

  perform set_config('app.allow_status_change', '1', true);

  if v.status in ('draft', 'rejected', 'archived') then
    update public.lokale
       set status = 'pending_review',
           status_zgloszenia = 'pending_review',
           wyslano_o = now(),
           powod_odrzucenia = null
     where id = p_lokal;
  elsif v.status = 'published' or v.status = 'pending_review' then
    update public.lokale
       set status_zgloszenia = 'pending_review',
           wyslano_o = now(),
           powod_odrzucenia = null
     where id = p_lokal;
  else
    raise exception 'Tego lokalu nie można teraz wysłać.';
  end if;
end;
$$;

create or replace function public.cofnij_zgloszenie(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lokale%rowtype;
begin
  if not (private.jest_czlonkiem(p_lokal) or private.jest_admin()) then
    raise exception 'Nie masz dostępu do tego lokalu.' using errcode = '42501';
  end if;
  select * into v from public.lokale where id = p_lokal;
  perform set_config('app.allow_status_change', '1', true);
  if v.status = 'pending_review' and not exists (
    select 1 from public.lokal_publikacje p where p.lokal_id = p_lokal
  ) then
    update public.lokale
       set status = 'draft',
           status_zgloszenia = 'none'
     where id = p_lokal;
  elsif v.status = 'published' and v.status_zgloszenia = 'pending_review' then
    update public.lokale
       set status_zgloszenia = 'none'
     where id = p_lokal;
  else
    raise exception 'Nie ma zgłoszenia do cofnięcia.';
  end if;
end;
$$;

create or replace function public.zatwierdz_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  errs text[];
  v public.lokale%rowtype;
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator publikuje lokale.' using errcode = '42501';
  end if;
  select * into v from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.';
  end if;
  if v.status <> 'pending_review' and v.status_zgloszenia <> 'pending_review' then
    raise exception 'To zgłoszenie nie czeka na weryfikację.';
  end if;
  errs := private.waliduj_do_wyslania(p_lokal);
  if coalesce(array_length(errs, 1), 0) > 0 then
    raise exception '%', array_to_string(errs, ' ');
  end if;
  perform private.skopiuj_publikacje(p_lokal, auth.uid());
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'published',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false,
         powod_odrzucenia = null,
         sprawdzono_o = now(),
         sprawdzil_id = auth.uid()
   where id = p_lokal;
end;
$$;

create or replace function public.odrzuc_lokal(p_lokal uuid, p_powod text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.lokale%rowtype;
  v_powod text := nullif(trim(coalesce(p_powod, '')), '');
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator odrzuca lokale.' using errcode = '42501';
  end if;
  if v_powod is null then
    raise exception 'Podaj powód, żeby właściciel wiedział, co poprawić.';
  end if;
  select * into v from public.lokale where id = p_lokal;
  if not found then
    raise exception 'Nie ma takiego lokalu.';
  end if;
  if v.status <> 'pending_review' and v.status_zgloszenia <> 'pending_review' then
    raise exception 'To zgłoszenie nie czeka na weryfikację.';
  end if;
  perform set_config('app.allow_status_change', '1', true);
  if exists (select 1 from public.lokal_publikacje p where p.lokal_id = p_lokal) then
    update public.lokale
       set status = 'published',
           status_zgloszenia = 'rejected',
           powod_odrzucenia = v_powod,
           sprawdzono_o = now(),
           sprawdzil_id = auth.uid()
     where id = p_lokal;
  else
    update public.lokale
       set status = 'rejected',
           status_zgloszenia = 'rejected',
           powod_odrzucenia = v_powod,
           sprawdzono_o = now(),
           sprawdzil_id = auth.uid()
     where id = p_lokal;
  end if;
end;
$$;

create or replace function public.archiwizuj_lokal(p_lokal uuid)
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
  delete from public.lokal_publikacje where lokal_id = p_lokal;
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'archived',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false,
         sprawdzono_o = now(),
         sprawdzil_id = auth.uid()
   where id = p_lokal;
end;
$$;

create or replace function public.dodaj_czlonka(
  p_lokal uuid,
  p_email text,
  p_rola public.rola_czlonka
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profil uuid;
  v_rola public.rola_uzytkownika;
begin
  if auth.uid() is null then
    raise exception 'Zaloguj się.';
  end if;
  if not (private.jest_wlascicielem_lokalu(p_lokal) or private.jest_admin()) then
    raise exception 'Członków dodaje właściciel lokalu.' using errcode = '42501';
  end if;
  select id, rola into v_profil, v_rola
  from public.profile
  where lower(email) = lower(trim(p_email));
  if v_profil is null then
    raise exception 'Nie ma konta z tym adresem. Osoba musi najpierw się zarejestrować.';
  end if;
  insert into public.lokal_czlonkowie (lokal_id, profil_id, rola)
  values (p_lokal, v_profil, p_rola)
  on conflict (lokal_id, profil_id) do update set rola = excluded.rola;

  if v_rola = 'klient' then
    perform set_config('app.allow_role_change', '1', true);
    update public.profile set rola = 'wlasciciel' where id = v_profil and rola = 'klient';
  end if;
end;
$$;

create or replace function public.usun_czlonka(p_lokal uuid, p_profil uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_zalozyciel uuid;
  v_rola public.rola_czlonka;
  v_wlascicieli int;
begin
  if not (private.jest_wlascicielem_lokalu(p_lokal) or private.jest_admin()) then
    raise exception 'Członków usuwa właściciel lokalu.' using errcode = '42501';
  end if;
  select wlasciciel_id into v_zalozyciel from public.lokale where id = p_lokal;
  if p_profil = v_zalozyciel then
    raise exception 'Nie usuniesz osoby, która założyła lokal.';
  end if;
  select rola into v_rola from public.lokal_czlonkowie where lokal_id = p_lokal and profil_id = p_profil;
  if v_rola is null then
    return;
  end if;
  select count(*) into v_wlascicieli
  from public.lokal_czlonkowie
  where lokal_id = p_lokal and rola = 'wlasciciel';
  if v_rola = 'wlasciciel' and v_wlascicieli <= 1 then
    raise exception 'Lokal musi mieć właściciela.';
  end if;
  delete from public.lokal_czlonkowie where lokal_id = p_lokal and profil_id = p_profil;
end;
$$;

create or replace function public.lista_czlonkow(p_lokal uuid)
returns table (profil_id uuid, email text, imie_nazwisko text, rola public.rola_czlonka)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email, p.imie_nazwisko, c.rola
  from public.lokal_czlonkowie c
  join public.profile p on p.id = c.profil_id
  where c.lokal_id = p_lokal
    and (private.jest_czlonkiem(p_lokal) or private.jest_admin());
$$;

create or replace function public.bootstrap_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_rola text;
begin
  -- W funkcji security definer current_user to właściciel funkcji, więc nie nadaje się do tej decyzji.
  -- Konto ze strony ma ustawione request.jwt.claim.role. Edytor SQL operatora nie ma takiego claimu.
  v_rola := coalesce(auth.role(), '');
  if v_rola = 'service_role' then
    null;
  elsif v_rola in ('authenticated', 'anon') or auth.uid() is not null then
    raise exception 'Administratora zakłada tylko operator bazy, nie konto na stronie.' using errcode = '42501';
  elsif session_user not in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    raise exception 'Administratora zakłada tylko operator bazy, nie konto na stronie.' using errcode = '42501';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Najpierw załóż zwykłe konto na ten adres, potem nadaj mu rolę administratora.';
  end if;
  perform set_config('app.allow_role_change', '1', true);
  update public.profile set rola = 'admin' where id = v_id;
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('rola', 'admin')
   where id = v_id;
  return v_id;
end;
$$;

create or replace function public.szukaj_lokali(
  p_miasto text default null,
  p_pojemnosc integer default null,
  p_okazja text default null,
  p_cena_max_grosze integer default null,
  p_udogodnienie text default null,
  p_sort text default 'cena'
)
returns table (
  lokal_id uuid,
  nazwa text,
  slug text,
  miasto text,
  miasto_norm text,
  dzielnica text,
  typ public.typ_lokalu,
  opis text,
  pojemnosc_max integer,
  cena_min_grosze integer,
  waluta text,
  jednostka_ceny public.jednostka_ceny,
  cena_na_zapytanie boolean,
  zdjecie_sciezka text,
  lat numeric,
  lng numeric,
  czy_przyklad boolean,
  liczba_sal integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    lp.lokal_id,
    lp.nazwa,
    lp.slug,
    lp.miasto,
    lp.miasto_norm,
    lp.dzielnica,
    lp.typ,
    lp.opis,
    lp.pojemnosc_max,
    lp.cena_min_grosze,
    lp.waluta,
    lp.jednostka_ceny,
    lp.cena_na_zapytanie,
    (
      select z.sciezka
      from public.opublikowane_zdjecia z
      where z.lokal_id = lp.lokal_id
      order by z.glowne desc, z.kolejnosc, z.id
      limit 1
    ) as zdjecie_sciezka,
    lp.lat,
    lp.lng,
    lp.czy_przyklad,
    (
      select count(*)::integer
      from public.opublikowane_sale s
      where s.lokal_id = lp.lokal_id
    ) as liczba_sal
  from public.lokal_publikacje lp
  where (
      p_miasto is null
      or trim(p_miasto) = ''
      or lp.miasto_norm = private.zloz_miasto(p_miasto)
    )
    and (
      p_pojemnosc is null
      or exists (
        select 1 from public.opublikowane_sale s
        where s.lokal_id = lp.lokal_id
          and s.pojemnosc_max >= p_pojemnosc
      )
    )
    and (
      p_okazja is null
      or trim(p_okazja) = ''
      or exists (
        select 1 from public.opublikowane_okazje o
        where o.lokal_id = lp.lokal_id
          and o.kod = p_okazja
      )
    )
    and (
      p_cena_max_grosze is null
      or exists (
        select 1 from public.opublikowane_sale s
        where s.lokal_id = lp.lokal_id
          and s.cena_na_zapytanie = false
          and s.kwota_grosze is not null
          and s.kwota_grosze <= p_cena_max_grosze
          and (p_pojemnosc is null or s.pojemnosc_max >= p_pojemnosc)
      )
    )
    and (
      p_udogodnienie is null
      or trim(p_udogodnienie) = ''
      or exists (
        select 1 from public.opublikowane_udogodnienia u
        where u.lokal_id = lp.lokal_id
          and u.kod = p_udogodnienie
      )
    )
  order by
    case when p_sort = 'pojemnosc' then lp.pojemnosc_max end desc nulls last,
    case when p_sort is distinct from 'pojemnosc' then lp.cena_min_grosze end asc nulls last,
    lp.nazwa;
$$;

create or replace function public.publikacja_po_adresie(p_miasto text, p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'lokal', to_jsonb(lp) - 'opublikowal_id',
    'sale', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.kolejnosc, s.nazwa)
      from public.opublikowane_sale s
      where s.lokal_id = lp.lokal_id
    ), '[]'::jsonb),
    'zdjecia', coalesce((
      select jsonb_agg(to_jsonb(z) order by z.glowne desc, z.kolejnosc, z.id)
      from public.opublikowane_zdjecia z
      where z.lokal_id = lp.lokal_id
    ), '[]'::jsonb),
    'udogodnienia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kod', u.kod,
        'nazwa', d.nazwa,
        'szczegol', u.szczegol
      ) order by d.kolejnosc)
      from public.opublikowane_udogodnienia u
      join public.udogodnienia d on d.kod = u.kod
      where u.lokal_id = lp.lokal_id
    ), '[]'::jsonb),
    'okazje', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kod', o.kod,
        'nazwa', k.nazwa,
        'nazwa_kafla', k.nazwa_kafla
      ) order by k.kolejnosc)
      from public.opublikowane_okazje o
      join public.okazje k on k.kod = o.kod
      where o.lokal_id = lp.lokal_id
    ), '[]'::jsonb)
  )
  from public.lokal_publikacje lp
  where lp.miasto_norm = private.zloz_miasto(p_miasto)
    and lp.slug = p_slug;
$$;

revoke all on function private.waliduj_do_wyslania(uuid) from public, anon, authenticated;
revoke all on function private.skopiuj_publikacje(uuid, uuid) from public, anon, authenticated;
revoke all on function private.utworz_profil() from public, anon, authenticated;
revoke all on function private.synchronizuj_email() from public, anon, authenticated;
grant execute on function private.utworz_profil() to supabase_auth_admin, service_role;
grant execute on function private.synchronizuj_email() to supabase_auth_admin, service_role;
grant execute on function private.dotknij() to anon, authenticated, service_role;
grant execute on function private.pilnuj_profilu() to authenticated, service_role;
grant execute on function private.uzupelnij_miasto() to authenticated, service_role;
grant execute on function private.pilnuj_statusu_lokalu() to authenticated, service_role;
grant execute on function private.oznacz_zmiany_lokalu() to authenticated, service_role;
grant execute on function private.jedno_zdjecie_glowne() to authenticated, service_role;

revoke all on function public.zostan_wlascicielem() from public;
revoke all on function public.utworz_lokal(text, text) from public;
revoke all on function public.wyslij_do_weryfikacji(uuid) from public;
revoke all on function public.cofnij_zgloszenie(uuid) from public;
revoke all on function public.zatwierdz_lokal(uuid) from public;
revoke all on function public.odrzuc_lokal(uuid, text) from public;
revoke all on function public.archiwizuj_lokal(uuid) from public;
revoke all on function public.dodaj_czlonka(uuid, text, public.rola_czlonka) from public;
revoke all on function public.lista_czlonkow(uuid) from public;
revoke all on function public.usun_czlonka(uuid, uuid) from public;
revoke all on function public.bootstrap_admin(text) from public;
revoke all on function public.szukaj_lokali(text, integer, text, integer, text, text) from public;
revoke all on function public.publikacja_po_adresie(text, text) from public;

grant execute on function public.zostan_wlascicielem() to authenticated;
grant execute on function public.utworz_lokal(text, text) to authenticated;
grant execute on function public.wyslij_do_weryfikacji(uuid) to authenticated;
grant execute on function public.cofnij_zgloszenie(uuid) to authenticated;
grant execute on function public.zatwierdz_lokal(uuid) to authenticated;
grant execute on function public.odrzuc_lokal(uuid, text) to authenticated;
grant execute on function public.archiwizuj_lokal(uuid) to authenticated;
grant execute on function public.dodaj_czlonka(uuid, text, public.rola_czlonka) to authenticated;
grant execute on function public.lista_czlonkow(uuid) to authenticated;
grant execute on function public.usun_czlonka(uuid, uuid) to authenticated;
grant execute on function public.bootstrap_admin(text) to service_role;
grant execute on function public.szukaj_lokali(text, integer, text, integer, text, text) to anon, authenticated;
grant execute on function public.publikacja_po_adresie(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Zdjęcia w Storage. Koszyk prywatny: nieopublikowany plik nie ma publicznego URL.
-- Limit 8 MB i typy plików to ograniczenie techniczne, nie próg liczby zdjęć.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'zdjecia-lokali',
  'zdjecia-lokali',
  false,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy zdjecia_odczyt_anon
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'zdjecia-lokali'
    and exists (
      select 1 from public.opublikowane_zdjecia z
      where z.sciezka = name
    )
  );

create policy zdjecia_odczyt_zalogowany
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'zdjecia-lokali'
    and (
      private.jest_admin()
      or private.jest_czlonkiem(private.uuid_albo_null((storage.foldername(name))[1]))
      or exists (
        select 1 from public.opublikowane_zdjecia z
        where z.sciezka = name
      )
    )
  );

create policy zdjecia_wstaw
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'zdjecia-lokali'
    and coalesce(array_length(storage.foldername(name), 1), 0) = 1
    and private.jest_czlonkiem(private.uuid_albo_null((storage.foldername(name))[1]))
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy zdjecia_podmien
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'zdjecia-lokali'
    and (
      private.jest_admin()
      or private.jest_czlonkiem(private.uuid_albo_null((storage.foldername(name))[1]))
    )
  )
  with check (
    bucket_id = 'zdjecia-lokali'
    and (
      private.jest_admin()
      or private.jest_czlonkiem(private.uuid_albo_null((storage.foldername(name))[1]))
    )
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );

create policy zdjecia_usun
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'zdjecia-lokali'
    and (
      private.jest_admin()
      or private.jest_czlonkiem(private.uuid_albo_null((storage.foldername(name))[1]))
    )
  );

-- ---------------------------------------------------------------------------
-- Słowniki. To katalog startowy, nie lokale i nie dane produkcyjne.
-- ---------------------------------------------------------------------------

insert into public.okazje (kod, nazwa, nazwa_kafla, zdjecie, kolejnosc) values
  ('urodziny', 'Urodziny dziecka', 'Urodziny dzieci', '/img/kat-urodziny.webp', 1),
  ('komunia', 'Komunia', 'Komunie', '/img/kat-komunie.webp', 2),
  ('18', '18-stka', '18-stki', '/img/kat-18stki.webp', 3),
  ('rodzinne', 'Przyjęcie rodzinne', 'Przyjęcia rodzinne', '/img/kat-rodzinne.webp', 4),
  ('chrzciny', 'Chrzciny', 'Chrzciny', null, 5),
  ('firmowe', 'Impreza firmowa', 'Firmowe', '/img/kat-firmowe.webp', 6);

insert into public.udogodnienia (kod, nazwa, filtr, kolejnosc) values
  ('parking', 'Parking', true, 1),
  ('klimatyzacja', 'Klimatyzacja', true, 2),
  ('kacik-dla-dzieci', 'Kącik dla dzieci', true, 3),
  ('wlasny-tort', 'Własny tort', true, 4),
  ('animator', 'Animator', true, 5),
  ('ogrodek', 'Ogródek', true, 6),
  ('naglosnienie', 'Nagłośnienie', true, 7),
  ('dostep-dla-wozkow', 'Dostęp dla wózków', true, 8),
  ('catering-wlasny', 'Catering własny', true, 9),
  ('wlasne-menu', 'Własne menu', true, 10);

comment on table public.lokale is
  'Kopia robocza lokalu. Gość jej nie widzi. Po akceptacji powstaje osobna migawka w lokal_publikacje.';
comment on column public.lokale.status is
  'draft=szkic, pending_review=do weryfikacji, published=opublikowany, rejected=odrzucony, archived=ukryty.';
comment on column public.lokale.ma_nieopublikowane_zmiany is
  'Prawda, gdy po publikacji zmieniono treść. Strona publiczna nadal pokazuje poprzednią migawkę.';
