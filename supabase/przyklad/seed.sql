-- PRZYKŁAD LOKALNY. Nie uruchamiaj na zdalnej bazie.
-- Skrypt npm run seed:przyklad odmawia, gdy host to nie 127.0.0.1 ani localhost.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000000a1',
  'authenticated',
  'authenticated',
  'przyklad.wlasciciel@example.test',
  extensions.crypt('przyklad-lokalne', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"imie_nazwisko":"Anna Przykład"}'::jsonb,
  now(), now()
where not exists (select 1 from auth.users where lower(email) = 'przyklad.wlasciciel@example.test');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000000a2',
  'authenticated',
  'authenticated',
  'przyklad.admin@example.test',
  extensions.crypt('przyklad-lokalne', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"imie_nazwisko":"Admin Przykład"}'::jsonb,
  now(), now()
where not exists (select 1 from auth.users where lower(email) = 'przyklad.admin@example.test');

select public.bootstrap_admin('przyklad.admin@example.test');

do $$
begin
  perform set_config('app.allow_role_change', '1', true);
  update public.profile
     set rola = 'wlasciciel'
   where lower(email) = 'przyklad.wlasciciel@example.test'
     and rola = 'klient';
end $$;

insert into public.lokale (
  id, wlasciciel_id, nazwa, slug, typ, opis, adres, kod, miasto, dzielnica,
  telefon_publiczny, zasady, godziny_od, godziny_do, jeden_obiekt, status, czy_przyklad
)
select
  '00000000-0000-4000-8000-0000000000b1',
  p.id,
  'PRZYKŁAD: Sala nad salą',
  'przyklad-sala-nad-sala',
  'sala_bankietowa',
  'To jest lokal przykładowy do lokalnego podglądu. Nie jest ofertą prawdziwego miejsca.',
  'ul. Przykładowa 1',
  '65-001',
  'Zielona Góra',
  'Centrum',
  '000000000',
  array['Przykładowa zasada: to nie jest regulamin lokalu.'],
  '12:00',
  '22:00',
  true,
  'draft',
  true
from public.profile p
where lower(p.email) = 'przyklad.wlasciciel@example.test'
  and not exists (select 1 from public.lokale where id = '00000000-0000-4000-8000-0000000000b1');

insert into public.lokal_czlonkowie (lokal_id, profil_id, rola)
select l.id, l.wlasciciel_id, 'wlasciciel'
from public.lokale l
where l.id = '00000000-0000-4000-8000-0000000000b1'
on conflict do nothing;

insert into public.lokal_dane_prywatne (lokal_id, email_kontaktowy, notatka)
values (
  '00000000-0000-4000-8000-0000000000b1',
  'przyklad.wlasciciel@example.test',
  'Notatka przykładowa. Gość jej nie widzi.'
)
on conflict (lokal_id) do nothing;

insert into public.sale (id, lokal_id, nazwa, opis_krotki, pojemnosc_max, jednostka, metraz, widoczna, kolejnosc)
values (
  '00000000-0000-4000-8000-0000000000c1',
  '00000000-0000-4000-8000-0000000000b1',
  'Cały lokal',
  'Jedna przestrzeń przykładowa.',
  80,
  'osoby',
  120,
  true,
  0
)
on conflict (id) do nothing;

insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
values ('00000000-0000-4000-8000-0000000000c1', 'PLN', 'za_sale', 180000, false)
on conflict (sala_id) do nothing;

insert into public.lokal_okazje (lokal_id, kod)
values ('00000000-0000-4000-8000-0000000000b1', 'urodziny')
on conflict do nothing;

insert into public.lokal_udogodnienia (lokal_id, kod, szczegol)
values ('00000000-0000-4000-8000-0000000000b1', 'parking', 'przykład, nie prawdziwy parking')
on conflict do nothing;

do $$
declare
  col text;
begin
  foreach col in array array[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_current', 'email_change_token_new',
    'phone_change_token', 'reauthentication_token'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = col
    ) then
      execute format(
        'update auth.users set %I = coalesce(%I, '''') where email like ''przyklad.%%@example.test''',
        col, col
      );
    end if;
  end loop;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now())
     where email like 'przyklad.%@example.test';
  end if;
end $$;

do $$
begin
  perform private.skopiuj_publikacje(
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000a2'
  );
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'published',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false
   where id = '00000000-0000-4000-8000-0000000000b1';
end $$;
