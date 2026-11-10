-- Dwa lokale właściciela A, izolacja od B, wycofanie zostawia zapytanie,
-- wstrzymanie zostawia stronę i godziny oraz odrzuca nowe zapytanie.

begin;

select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'owner.a@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated', 'authenticated', 'owner.b@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated', 'authenticated', 'admin.one@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

select private.bootstrap_admin('admin.one@example.test');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Pierwszy', 'Zielona Góra');
select public.utworz_lokal('', 'Zielona Góra');

update public.lokale set nazwa = 'Pierwszy zapis' where nazwa = 'Pierwszy';
update public.lokale set nazwa = 'Pierwszy zapis' where nazwa = 'Pierwszy zapis';
update public.lokale set opis = 'Opis', godziny_od = '10:00', godziny_do = '22:00'
 where nazwa = 'Pierwszy zapis';
update public.sale s set nazwa = 'Sala', pojemnosc_max = 20
  from public.lokale l
 where s.lokal_id = l.id and l.nazwa = 'Pierwszy zapis';
insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 10000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.nazwa = 'Pierwszy zapis';
select public.wyslij_do_weryfikacji(id) from public.lokale where nazwa = 'Pierwszy zapis';

reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Obcy', 'Żary');

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select public.zatwierdz_lokal(id) from public.lokale where nazwa = 'Pierwszy zapis';

reset role;
create temp table fx as
select
  (select id from public.lokale where nazwa = 'Pierwszy zapis') as swoj,
  (select id from public.lokale where nazwa = 'Obcy') as obcy,
  (select s.id from public.opublikowane_sale s
     join public.lokale l on l.id = s.lokal_id
    where l.nazwa = 'Pierwszy zapis') as sala;
grant select on fx to anon, authenticated;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.lokale), 2::bigint, 'właściciel A widzi swoje dwa lokale');
select is(
  (select count(*) from public.lokale where nazwa = 'Pierwszy zapis'),
  1::bigint,
  'powtórny zapis szkicu nie dubluje lokalu'
);

select throws_ok(
  $$ select public.wycofaj_wlasny_lokal(obcy) from fx $$,
  '42501',
  'Ten lokal możesz wycofać tylko jako jego właściciel.',
  'właściciel A nie wycofuje lokalu B'
);

select throws_ok(
  $$ select public.wstrzymaj_rezerwacje(obcy) from fx $$,
  '42501',
  'Rezerwacje tego lokalu wstrzymuje tylko jego właściciel.',
  'właściciel A nie wstrzymuje lokalu B'
);

select lives_ok(
  $$ select public.wstrzymaj_rezerwacje(id) from public.lokale where nazwa = 'Pierwszy zapis' $$,
  'właściciel wstrzymuje własny opublikowany lokal'
);

select is(
  (select godziny_od::text from public.lokale where nazwa = 'Pierwszy zapis'),
  '10:00:00',
  'wstrzymanie nie rusza godzin'
);
select is(
  (select status::text from public.lokale where nazwa = 'Pierwszy zapis'),
  'published',
  'wstrzymanie nie zmienia statusu moderacji'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.szukaj_lokali('Zielona Góra', null, null, null, null, 'cena')),
  1::bigint,
  'wstrzymany lokal zostaje w wyszukiwarce'
);

select throws_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala, null,
      (now() at time zone 'Europe/Warsaw')::date + 7,
      '14:00', 4, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from fx
  $$,
  'P0001',
  'Ten lokal chwilowo nie przyjmuje rezerwacji. Zapytanie nie zostało zapisane.',
  'zapytanie do wstrzymanego lokalu odpada w bazie'
);

reset role;
select is((select count(*) from public.zapytania), 0::bigint, 'odrzucone zapytanie nie tworzy wiersza');

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.wznow_rezerwacje(id) from public.lokale where nazwa = 'Pierwszy zapis' $$,
  'właściciel wznawia rezerwacje'
);
select is(
  (select status::text from public.lokale where nazwa = 'Pierwszy zapis'),
  'published',
  'wznowienie nie publikuje szkicu od nowa'
);

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      l.id, s.id, null,
      (now() at time zone 'Europe/Warsaw')::date + 8,
      '15:00', 2, 'Gość Test', '500600700', 'gosc@example.test', null
    )
    from public.lokale l
    join public.opublikowane_sale s on s.lokal_id = l.id
    where l.nazwa = 'Pierwszy zapis'
  $$,
  'po wznowieniu zapytanie przechodzi'
);

select lives_ok(
  $$ select public.wycofaj_wlasny_lokal(id) from public.lokale where nazwa = 'Pierwszy zapis' $$,
  'właściciel wycofuje własny lokal'
);

reset role;
select is(
  (select count(*) from public.zapytania),
  1::bigint,
  'wycofanie zostawia historię zapytań'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.lokal_publikacje),
  0::bigint,
  'wycofany lokal znika z publicznej migawki'
);

select * from finish();
rollback;
