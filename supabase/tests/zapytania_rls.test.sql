-- Zapytanie o termin: gość zapisuje i nie czyta, konto nie dziedziczy gościa po e-mailu.
-- Uruchomienie: supabase test db

begin;

select plan(24);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'owner.one@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'owner.two@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'admin.one@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'klient@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

select private.bootstrap_admin('admin.one@example.test');

select is(
  (select prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'wyslij_zapytanie'),
  false,
  'public.wyslij_zapytanie nie jest security definer'
);

select is(
  (select prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'wyslij_zapytanie'),
  true,
  'private.wyslij_zapytanie jest security definer'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Sala Testowa', 'Zielona Góra');

update public.sale s
   set nazwa = 'Cały lokal', pojemnosc_max = 40
  from public.lokale l
 where s.lokal_id = l.id
   and l.wlasciciel_id = '11111111-1111-4111-8111-111111111111';

insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_osobe', 10000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111';

update public.lokale
   set opis = 'Opis testowy'
 where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

select public.wyslij_do_weryfikacji(id)
from public.lokale
where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Szkic Drugi', 'Żary');

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select public.zatwierdz_lokal(id)
from public.lokale
where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

reset role;

create temp table fx (
  opub uuid,
  sala uuid,
  szkic uuid,
  sala_cudza uuid,
  gosc uuid
);
insert into fx (opub, sala, szkic, sala_cudza)
select
  (select id from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  (select s.id from public.opublikowane_sale s
     join public.lokale l on l.id = s.lokal_id
    where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  (select id from public.lokale where wlasciciel_id = '22222222-2222-4222-8222-222222222222'),
  (select s.id from public.sale s
     join public.lokale l on l.id = s.lokal_id
    where l.wlasciciel_id = '22222222-2222-4222-8222-222222222222');
grant select on fx to anon, authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.zapytania',
  '42501',
  'permission denied for table zapytania',
  'gość nie czyta zapytań'
);

select throws_ok(
  $$
    insert into public.zapytania (
      lokal_id, sala_id, data, godzina_od, liczba_gosci, imie_nazwisko, telefon, email
    )
    select opub, sala, current_date + 3, '14:00', 4, 'Gość Test', '500600700', 'gosc@example.test'
    from fx
  $$,
  '42501',
  'permission denied for table zapytania',
  'gość nie wstawia wiersza z pominięciem funkcji'
);

select throws_ok(
  $$
    select public.wyslij_zapytanie(
      szkic, sala_cudza, null,
      (now() at time zone 'Europe/Warsaw')::date + 7,
      '14:00', 4, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from fx
  $$,
  'P0001',
  'Ten lokal nie jest opublikowany.',
  'szkic nie przyjmuje zapytania'
);

select throws_ok(
  $$
    select public.wyslij_zapytanie(
      opub, sala_cudza, null,
      (now() at time zone 'Europe/Warsaw')::date + 7,
      '14:00', 4, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from fx
  $$,
  'P0001',
  'Wybierz salę z opublikowanego opisu tego lokalu.',
  'sala z innego lokalu odpada'
);

select throws_ok(
  $$
    select public.wyslij_zapytanie(
      opub, sala, null,
      (now() at time zone 'Europe/Warsaw')::date + 7,
      '14:00', 80, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from fx
  $$,
  'P0001',
  'Ta sala nie mieści tylu gości.',
  'liczba gości ponad pojemność odpada'
);

select throws_ok(
  $$
    select public.wyslij_zapytanie(
      opub, sala, null,
      (now() at time zone 'Europe/Warsaw')::date - 1,
      '14:00', 4, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from fx
  $$,
  'P0001',
  'Data musi być dzisiaj albo w ciągu najbliższych 18 miesięcy.',
  'wczorajsza data odpada'
);

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      opub, sala, null,
      (now() at time zone 'Europe/Warsaw')::date + 7,
      '14:00', 4, 'Gość Test', '500600700', 'klient@example.test', null
    )
    from fx
  $$,
  'gość zapisuje zapytanie do opublikowanego lokalu'
);

reset role;
update fx set gosc = (select id from public.zapytania where klient_id is null);

select is(
  (select klient_id is null from public.zapytania where email = 'klient@example.test'),
  true,
  'zapytanie gościa nie dostaje klient_id po samym e-mailu'
);

select is(
  (select status::text from public.zapytania where email = 'klient@example.test'),
  'nowe',
  'nowe zapytanie nie jest rezerwacją'
);

select is(
  (select kwota_szacunkowa from public.zapytania where email = 'klient@example.test'),
  40000,
  'szacunek to 100 zł za osobę razy 4 gości'
);

select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.zapytania),
  0::bigint,
  'konto nie widzi zapytania gościa z tym samym e-mailem'
);

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      opub, sala, null,
      (now() at time zone 'Europe/Warsaw')::date + 8,
      '15:00', 2, 'Klient Test', '500600701', 'klient@example.test', 'z konta'
    )
    from fx
  $$,
  'zalogowany klient zapisuje własne zapytanie'
);

select is(
  (select count(*) from public.zapytania),
  1::bigint,
  'konto widzi tylko wiersz z własnym klient_id'
);

select is(
  (select klient_id from public.zapytania),
  '44444444-4444-4444-8444-444444444444'::uuid,
  'klient_id jest równe auth.uid(), nie parametrowi'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.zapytania),
  0::bigint,
  'inny właściciel nie widzi zapytań'
);

select throws_ok(
  $$ select public.odrzuc_zapytanie(gosc) from fx $$,
  '42501',
  'Nie możesz odrzucić tego zapytania.',
  'inny właściciel nie odrzuca'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.zapytania),
  2::bigint,
  'właściciel widzi zapytania swojego lokalu'
);

select throws_ok(
  $$ update public.zapytania set status = 'zaakceptowane' $$,
  '42501',
  'permission denied for table zapytania',
  'właściciel nie zmienia statusu na zaakceptowane'
);

select lives_ok(
  $$ select public.odrzuc_zapytanie(gosc) from fx $$,
  'właściciel odrzuca zapytanie gościa'
);

reset role;

select is(
  (select status::text from public.zapytania where klient_id is null),
  'odrzucone',
  'odrzucenie nie tworzy rezerwacji'
);

select is(
  (select status::text from public.zapytania where klient_id = '44444444-4444-4444-8444-444444444444'),
  'nowe',
  'odrzucenie cudzego wiersza nie rusza zapytania klienta'
);

select throws_ok(
  $$
    insert into public.zapytania (
      lokal_id, sala_id, data, godzina_od, liczba_gosci, imie_nazwisko, telefon, email
    )
    select lokal_id, id, current_date + 3, '14:00', 4, 'Gość Test', '500600700', 'inny@example.test'
    from public.opublikowane_sale
  $$,
  '42501',
  'Zapytanie zmienia tylko serwerowa funkcja wysyłki albo odpowiedzi.',
  'bez flagi funkcji nie da się wstawić wiersza'
);

select * from finish();
rollback;
