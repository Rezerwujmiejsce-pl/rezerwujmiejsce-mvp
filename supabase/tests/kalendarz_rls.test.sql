-- Kalendarz wybranego lokalu. Gość dostaje tylko wolne/zajęte/wstrzymane.
-- Sala A nie blokuje sali B. Odrzucone, wygasłe i inny termin nie zajmują slotu.
-- Transakcja jest wycofywana. Nie zmienia danych DEV.

begin;

select plan(39);

select is(
  (select (start_o at time zone 'UTC')::text
     from private.okres_warszawa('2026-07-15', '12:00', '13:00', null, null)),
  '2026-07-15 10:00:00',
  'lato: 12:00 w Warszawie to 10:00 UTC'
);
select is(
  (select (start_o at time zone 'UTC')::text
     from private.okres_warszawa('2026-01-15', '12:00', '13:00', null, null)),
  '2026-01-15 11:00:00',
  'zima: 12:00 w Warszawie to 11:00 UTC'
);
select is(
  (select (koniec_o at time zone 'UTC')::text
     from private.okres_warszawa('2026-07-15', '22:00', '02:00', null, null)),
  '2026-07-16 00:00:00',
  'godzina do wcześniejsza niż od kończy się następnego dnia'
);
select throws_ok(
  $$ select * from private.okres_warszawa('2026-03-29', '02:30', '02:45', null, null) $$,
  'P0001',
  'Ten przedział nie mieści się w kalendarzu Europy/Warszawy.',
  'luka zmiany czasu wiosną nie tworzy pustego przedziału'
);
select is(
  (select (start_o at time zone 'UTC')::text
     from private.okres_warszawa('2026-10-25', '02:30', '03:30', null, null)),
  '2026-10-25 01:30:00',
  'powtórzona godzina jesienią bierze czas zimowy zwracany przez PostgreSQL'
);

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'dodaj_blokade', 'usun_blokade', 'pasek_dostepnosci',
        'dodaj_blokady_dni', 'oznacz_przedzial_wolny'
      )),
  0::bigint,
  'publiczne funkcje kalendarza są invoker'
);
select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'pasek_dostepnosci'),
  true,
  'prywatny pasek jest definer i nie oddaje surowych zapytań'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'authenticated', 'authenticated', 'kalendarz.a@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'authenticated', 'authenticated', 'kalendarz.b@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  'authenticated', 'authenticated', 'kalendarz.admin@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

select private.bootstrap_admin('kalendarz.admin@example.test');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Kalendarz A', 'Zielona Góra');
update public.lokale set opis = 'Opis', godziny_od = '10:00', godziny_do = '22:00'
 where nazwa = 'Kalendarz A';
update public.sale s set nazwa = 'Sala A', pojemnosc_max = 20
  from public.lokale l
 where s.lokal_id = l.id and l.nazwa = 'Kalendarz A';
insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 10000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.nazwa = 'Kalendarz A' and s.nazwa = 'Sala A';
insert into public.sale (lokal_id, nazwa, pojemnosc_max, kolejnosc)
select id, 'Sala B', 12, 1 from public.lokale where nazwa = 'Kalendarz A';
insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 8000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.nazwa = 'Kalendarz A' and s.nazwa = 'Sala B';
select public.wyslij_do_weryfikacji(id) from public.lokale where nazwa = 'Kalendarz A';

reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Kalendarz obcy', 'Żary');

reset role;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-ccccccccccc3","role":"authenticated"}', true);
set local role authenticated;
select public.zatwierdz_lokal(id) from public.lokale where nazwa = 'Kalendarz A';

reset role;
create temp table fx as
select
  (select id from public.lokale where nazwa = 'Kalendarz A') as swoj,
  (select id from public.lokale where nazwa = 'Kalendarz obcy') as obcy,
  (select s.id from public.sale s
     join public.lokale l on l.id = s.lokal_id
    where l.nazwa = 'Kalendarz A' and s.nazwa = 'Sala A') as sala_a,
  (select s.id from public.sale s
     join public.lokale l on l.id = s.lokal_id
    where l.nazwa = 'Kalendarz A' and s.nazwa = 'Sala B') as sala_b,
  (now() at time zone 'Europe/Warsaw')::date + 30 as dzien,
  (now() at time zone 'Europe/Warsaw')::date + 31 as drugi,
  (now() at time zone 'Europe/Warsaw')::date + 32 as trzeci;
grant select on fx to anon, authenticated;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ select id from public.blokady_terminu $$,
  '42501',
  'permission denied for table blokady_terminu',
  'gość nie czyta tabeli blokad'
);
select throws_ok(
  $$ select email from public.pasek_dostepnosci((select swoj from fx), (select dzien from fx), (select dzien from fx)) $$,
  '42703',
  'column "email" does not exist',
  'publiczny pasek nie ma kolumny e-mail ani identyfikatora zapytania'
);
select throws_ok(
  $$ select public.dodaj_blokade(swoj, sala_a, dzien, '12:00', '13:00', null) from fx $$,
  '42501',
  'permission denied for function dodaj_blokade',
  'gość nie zapisuje blokady'
);
select is(
  (select count(*) from fx cross join lateral public.pasek_dostepnosci(fx.obcy, fx.dzien, fx.dzien) p),
  0::bigint,
  'szkic nie ma publicznego paska'
);
select is(
  (select p.stan from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.dzien) p),
  'wolne',
  'opublikowany lokal bez zajętości jest wolny'
);
select throws_ok(
  $$ select * from public.pasek_dostepnosci((select swoj from fx), (select dzien from fx), (select dzien + 42 from fx)) $$,
  'P0001',
  'Podaj zakres co najwyżej 42 dni.',
  'pasek nie przyjmuje zakresu dłuższego niż 42 dni'
);

reset role;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.dodaj_blokade(swoj, sala_a, dzien, '12:00', '13:00', null) from fx $$,
  '42501',
  'Terminy blokuje właściciel tego lokalu.',
  'obcy właściciel nie blokuje cudzego lokalu'
);
select is(
  (select count(*) from public.blokady_terminu),
  0::bigint,
  'obcy właściciel nie widzi cudzych blokad'
);

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.dodaj_blokade(swoj, sala_a, dzien, '12:00', '16:00', 'wewnętrzna') from fx $$,
  'właściciel blokuje salę A'
);
select lives_ok(
  $$ select public.dodaj_blokade(swoj, sala_b, dzien, '12:00', '16:00', null) from fx $$,
  'ta sama godzina na sali B nie jest konfliktem'
);
select throws_ok(
  $$ select public.dodaj_blokade(swoj, null, dzien, '12:00', '16:00', null) from fx $$,
  'P0001',
  'Ten przedział nachodzi na blokadę albo zapytanie. Nie oznaczam go jako wolny i niczego nie odwołuję.',
  'blokada całego lokalu nie wchodzi na zajętą salę'
);
select throws_ok(
  $$ select public.dodaj_blokady_dni(swoj, sala_a, array[trzeci, trzeci], '18:00', '20:00', null) from fx $$,
  'P0001',
  'Ten przedział nachodzi na blokadę albo zapytanie. Nie oznaczam go jako wolny i niczego nie odwołuję.',
  'nachodzący zapis wielu dni wycofuje cały zapis'
);
select is(
  (select count(*) from public.blokady_terminu where dzien = (select trzeci from fx)),
  0::bigint,
  'po odmowie nie zostaje częściowa blokada'
);
select is(
  (select public.oznacz_przedzial_wolny(swoj, sala_a, dzien, null, null) from fx),
  1,
  'zwolnienie sali A kasuje tylko jej blokadę'
);
select is(
  (select count(*) from public.blokady_terminu),
  1::bigint,
  'blokada sali B zostaje'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select p.stan from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.dzien) p),
  'wolne',
  'zajęta jedna sala zostawia dzień wolny, gdy druga sala jest wolna'
);

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala_a, null, dzien, '14:00', 2,
      'Gość Test', '500600700', 'kalendarz-gosc@example.test', 'notatka-tajna'
    ) from fx
  $$,
  'zapytanie wchodzi na wolną salę mimo blokady drugiej'
);

reset role;
select set_config('app.allow_inquiry_change', '1', true);
update public.zapytania
   set status = 'odrzucone'
 where email = 'kalendarz-gosc@example.test';
select set_config('app.allow_inquiry_change', '', true);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala_a, null, dzien, '14:00', 2,
      'Gość Test', '500600700', 'kalendarz-gosc@example.test', 'notatka-tajna'
    ) from fx
  $$,
  'odrzucone zapytanie nie blokuje tego samego terminu'
);
select throws_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala_a, null, dzien, '16:00', 2,
      'Inny Gość', '500600701', 'kalendarz-inny@example.test', null
    ) from fx
  $$,
  'P0001',
  'Ten termin jest już zajęty. Zapytanie nie zostało zapisane.',
  'drugie zapytanie na tę samą salę i nachodzący czas odpada'
);

reset role;
select is(
  (select count(*) from public.zapytania where email = 'kalendarz-inny@example.test'),
  0::bigint,
  'odmowa nie tworzy wiersza zapytania'
);
select is(
  (select count(*) from public.zapytania where status = 'nowe' and email = 'kalendarz-gosc@example.test'),
  1::bigint,
  'zostaje jedno wstępne zapytanie'
);

select set_config('app.allow_inquiry_change', '1', true);
update public.zapytania
   set status = 'wygasle'
 where email = 'kalendarz-gosc@example.test' and status = 'nowe';
select set_config('app.allow_inquiry_change', '', true);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ select public.dodaj_blokade(swoj, sala_a, dzien, '14:00', '16:00', null) from fx $$,
  'wygasłe zapytanie nie blokuje sali'
);

reset role;
select set_config('app.allow_inquiry_change', '1', true);
update public.zapytania
   set status = 'zaakceptowane'
 where email = 'kalendarz-gosc@example.test' and status = 'wygasle';
select set_config('app.allow_inquiry_change', '', true);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.oznacz_przedzial_wolny(swoj, sala_a, dzien, '14:00', '18:00') from fx $$,
  'P0001',
  'Nie oznaczam zajętego przedziału jako wolny. Zapytanie zostaje, nic nie odwołuję.',
  'właściciel nie zdejmuje przyjętego terminu oznaczeniem wolne'
);
select is(
  (select count(*) from public.zapytania where email = 'kalendarz-gosc@example.test' and status = 'zaakceptowane'),
  1::bigint,
  'oznaczenie wolne nie zmienia statusu zapytania'
);
select is(
  (select count(*) from public.blokady_terminu where sala_id = (select sala_a from fx)),
  1::bigint,
  'odmowa zwolnienia nie kasuje istniejącej blokady'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select lives_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala_b, null, drugi, '14:00', 2,
      'Gość B', '500600702', 'kalendarz-b-sala@example.test', null
    ) from fx
  $$,
  'sala B przyjmuje zapytanie, gdy zajęta jest sala A innego dnia'
);

reset role;
select ok(
  (select coalesce(string_agg(p.stan, ','), '')
     from fx
     cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.drugi) p) not like '%kalendarz%',
  'publiczny pasek nie zawiera adresu e-mail'
);
select is(
  (select p.stan from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.drugi, fx.drugi) p),
  'wolne',
  'dzień z zajętą jedną salą zostaje wolny'
);
select is(
  (select p.stan from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.dzien) p),
  'zajete',
  'dzień jest zajęty, gdy każda sala ma nachodzenie'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;
select public.wstrzymaj_rezerwacje(swoj) from fx;

reset role;
set local role anon;
select is(
  (select count(*) from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.drugi) p where p.stan = 'wolne'),
  0::bigint,
  'wstrzymany lokal nie ogłasza wolnych dni'
);
select is(
  (select p.stan from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.dzien) p),
  'wstrzymane',
  'wstrzymanie widać na pasku, strona dalej istnieje'
);

reset role;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}', true);
set local role authenticated;
select public.wycofaj_wlasny_lokal(swoj) from fx;

reset role;
set local role anon;
select is(
  (select count(*) from fx cross join lateral public.pasek_dostepnosci(fx.swoj, fx.dzien, fx.drugi) p),
  0::bigint,
  'wycofany lokal znika z publicznego paska'
);

select * from finish();
rollback;
