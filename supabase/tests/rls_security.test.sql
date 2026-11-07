-- Testy ról: gość, właściciel, inny właściciel, administrator.
-- Uruchomienie: supabase test db

begin;

select plan(53);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'owner.one@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"rola":"admin","imie_nazwisko":"Właściciel Jeden"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'owner.two@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'admin.one@example.test',
    extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now()
  );

select is(
  (select rola::text from public.profile where id = '11111111-1111-4111-8111-111111111111'),
  'klient',
  'metadata z rolą admin przy rejestracji nie robi administratora'
);

select private.bootstrap_admin('admin.one@example.test');

select is(
  (select rola::text from public.profile where email = 'admin.one@example.test'),
  'admin',
  'bootstrap operatora nadaje administratora'
);

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
grant update (rola) on public.profile to authenticated;
set local role authenticated;

select lives_ok(
  $$ select public.zostan_wlascicielem() $$,
  'klient może zostać właścicielem'
);

select is(
  (select rola::text from public.profile where id = '11111111-1111-4111-8111-111111111111'),
  'wlasciciel',
  'rola po zostan_wlascicielem to wlasciciel, nie admin'
);

select set_config('app.allow_role_change', '', true);

select throws_ok(
  $$ update public.profile set rola = 'admin' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  'Roli nie można zmienić samodzielnie.',
  'właściciel nie nadaje sobie roli administratora'
);

select throws_ok(
  $$ select private.bootstrap_admin('owner.one@example.test') $$,
  '42501',
  'permission denied for function bootstrap_admin',
  'konto na stronie nie woła bootstrap_admin'
);

select is(
  (select to_regprocedure('public.bootstrap_admin(text)') is null),
  true,
  'bootstrap_admin nie istnieje w schemacie public'
);

select is(
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef),
  0::bigint,
  'w public nie ma funkcji security definer'
);

select is(
  (select prosecdef from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'zatwierdz_lokal'),
  true,
  'zatwierdz_lokal jest security definer tylko w private'
);

select lives_ok(
  $$ select public.utworz_lokal('Sala Testowa', 'Zielona Góra') $$,
  'właściciel tworzy szkic'
);

select is(
  (select status::text from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  'draft',
  'nowy lokal jest szkicem'
);

select throws_ok(
  $$
    update public.lokale
       set status = 'published'
     where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '42501',
  'Te pola zmienia tylko weryfikacja, nie formularz.',
  'właściciel nie publikuje sam'
);

select lives_ok(
  $$
    update public.sale s
       set nazwa = 'Cały lokal', pojemnosc_max = 40
      from public.lokale l
     where s.lokal_id = l.id
       and l.wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel uzupełnia salę'
);

select lives_ok(
  $$
    insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
    select s.id, 'PLN', 'za_sale', 150000, false
    from public.sale s
    join public.lokale l on l.id = s.lokal_id
    where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel ustawia cenę'
);

select lives_ok(
  $$
    update public.lokale
       set nazwa = 'Sala Testowa', opis = 'Opis testowy'
     where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel zapisuje opis'
);

select lives_ok(
  $$
    select public.wyslij_do_weryfikacji(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel wysyła do weryfikacji'
);

select is(
  (select status::text from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  'pending_review',
  'po wysłaniu status to pending_review'
);

select throws_ok(
  $$ select public.zatwierdz_lokal(id) from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  'Tylko administrator publikuje lokale.',
  'właściciel nie wywołuje akceptacji'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'inny właściciel nie widzi cudzego szkicu'
);

with upd as (
  update public.lokale
     set opis = 'podmienione'
   where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
   returning 1
)
select is((select count(*) from upd), 0::bigint, 'inny właściciel nie zmienia cudzego lokalu');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.lokale',
  '42501',
  'permission denied for table lokale',
  'gość nie czyta kopii roboczych'
);

select throws_ok(
  'select count(*) from public.lokal_dane_prywatne',
  '42501',
  'permission denied for table lokal_dane_prywatne',
  'gość nie czyta kontaktu wewnętrznego'
);

select is(
  (select count(*) from public.lokal_publikacje),
  0::bigint,
  'gość nie widzi lokalu przed akceptacją'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$
    select public.zatwierdz_lokal(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'administrator publikuje'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.lokal_publikacje),
  1::bigint,
  'gość widzi opublikowaną migawkę'
);

select is(
  (select nazwa from public.lokal_publikacje limit 1),
  'Sala Testowa',
  'migawka ma nazwę z chwili akceptacji'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select set_config('app.allow_status_change', '', true);

select lives_ok(
  $$
    update public.lokale
       set opis = 'Opis po publikacji, jeszcze niezaakceptowany'
     where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel może edytować opublikowany lokal'
);

select is(
  (select ma_nieopublikowane_zmiany from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
  true,
  'edycja oznacza nieopublikowane zmiany'
);

select throws_ok(
  $$
    update public.lokale
       set ma_nieopublikowane_zmiany = false
     where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  '42501',
  'Nie można samemu schować informacji o nieopublikowanych zmianach.',
  'właściciel nie chowa flagi zmian'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select opis from public.lokal_publikacje limit 1),
  'Opis testowy',
  'gość nadal widzi poprzedni opis'
);

select throws_ok(
  'select count(*) from public.zdjecia',
  '42501',
  'permission denied for table zdjecia',
  'gość nie czyta tabeli roboczych zdjęć'
);

select lives_ok(
  $$ select * from public.szukaj_lokali('Zielona Góra', 40, null, 200000, null, 'cena') $$,
  'wyszukiwanie gościa działa na migawce'
);

select is(
  (select count(*) from public.szukaj_lokali('Żary', null, null, null, null, 'cena')),
  0::bigint,
  'inne miasto nie zwraca lokalu z Zielonej Góry'
);

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$
    select public.dodaj_czlonka(
      (select id from public.lokale where wlasciciel_id = '11111111-1111-4111-8111-111111111111'),
      'owner.two@example.test',
      'wlasciciel'
    )
  $$,
  '42501',
  null,
  'obcy nie dopisuje się do cudzego lokalu'
);

-- Zdjęcie: opublikowany obiekt nie da się nadpisać ani skasować.
-- Nowa wersja to nowy plik. Stara ścieżka zostaje w migawce do kolejnej akceptacji.

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('app.allow_status_change', '', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.zdjecia (id, lokal_id, sciezka, mime, rozmiar_bajty, glowne)
    select
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      l.id,
      l.id::text || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
      'image/jpeg',
      128,
      true
    from public.lokale l
    where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel dodaje zdjęcie szkicu'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, metadata)
    select 'zdjecia-lokali', z.sciezka, '{"mimetype":"image/jpeg","mark":"draft"}'::jsonb
    from public.zdjecia z
    where z.id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'właściciel wgrywa plik szkicu'
);

with upd as (
  update storage.objects
     set metadata = '{"mimetype":"image/jpeg","mark":"draft-edited"}'::jsonb
   where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
   returning 1
)
select is((select count(*) from upd), 1::bigint, 'nieopublikowany plik można jeszcze poprawić');

select lives_ok(
  $$
    select public.wyslij_do_weryfikacji(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel wysyła lokal ze zdjęciem'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$
    select public.zatwierdz_lokal(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'administrator publikuje lokal ze zdjęciem'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

with upd as (
  update storage.objects
     set metadata = '{"mimetype":"image/jpeg","mark":"tampered"}'::jsonb
   where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
   returning 1
)
select is((select count(*) from upd), 0::bigint, 'właściciel nie nadpisuje opublikowanego pliku');

with del as (
  delete from storage.objects
   where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
   returning 1
)
select is((select count(*) from del), 0::bigint, 'właściciel nie kasuje opublikowanego pliku');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from storage.objects where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),
  1::bigint,
  'gość nadal czyta opublikowany plik po próbie kasowania'
);

select is(
  (select sciezka from public.opublikowane_zdjecia where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  (select name from storage.objects where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'),
  'migawka wskazuje ten sam, nienaruszony plik'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('app.allow_status_change', '', true);
set local role authenticated;

select lives_ok(
  $$
    insert into public.zdjecia (id, lokal_id, sciezka, mime, rozmiar_bajty, kolejnosc, glowne)
    select
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      l.id,
      l.id::text || '/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg',
      'image/jpeg',
      256,
      1,
      false
    from public.lokale l
    where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel dodaje drugie zdjęcie jako nowy plik'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, metadata)
    select 'zdjecia-lokali', z.sciezka, '{"mimetype":"image/jpeg","mark":"next"}'::jsonb
    from public.zdjecia z
    where z.id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  $$,
  'nowy plik nie koliduje z opublikowanym'
);

select lives_ok(
  $$
    delete from public.zdjecia where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  'właściciel usuwa zdjęcie ze szkicu, nie z magazynu'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;

select is(
  (select count(*) from public.opublikowane_zdjecia where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'po usunięciu ze szkicu migawka nadal ma stare zdjęcie'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('app.allow_status_change', '', true);
set local role authenticated;

select lives_ok(
  $$
    select public.wyslij_do_weryfikacji(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'właściciel wysyła nową wersję zdjęć'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$
    select public.zatwierdz_lokal(id)
    from public.lokale
    where wlasciciel_id = '11111111-1111-4111-8111-111111111111'
  $$,
  'administrator publikuje nową wersję zdjęć'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (select count(*) from public.opublikowane_zdjecia where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'po akceptacji stara ścieżka wypada z migawki'
);

select is(
  (select count(*) from public.opublikowane_zdjecia where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1::bigint,
  'po akceptacji migawka wskazuje nowy plik'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

with del as (
  delete from storage.objects
   where name like '%/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
   returning 1
)
select is((select count(*) from del), 1::bigint, 'po wypadnięciu z migawki stary plik można skasować');

with del as (
  delete from storage.objects
   where name like '%/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg'
   returning 1
)
select is((select count(*) from del), 0::bigint, 'świeżo opublikowanego pliku nie da się skasować');

select * from finish();
rollback;
