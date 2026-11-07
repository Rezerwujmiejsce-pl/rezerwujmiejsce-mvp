-- Testy ról: gość, właściciel, inny właściciel, administrator.
-- Uruchomienie: supabase test db

begin;

select plan(31);

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

select public.bootstrap_admin('admin.one@example.test');

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
  $$ select public.bootstrap_admin('owner.one@example.test') $$,
  '42501',
  null,
  'konto na stronie nie woła bootstrap_admin'
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

select * from finish();
rollback;
