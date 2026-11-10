-- Administrator zmienia status zapytania. Anulowane nie zajmuje sali.
-- Kwota się nie zmienia. Nie ma płatności. Transakcja jest wycofywana.

begin;

select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'authenticated', 'authenticated', 'zapadmin.owner@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
  'authenticated', 'authenticated', 'zapadmin.klient@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3',
  'authenticated', 'authenticated', 'zapadmin.admin@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

select private.bootstrap_admin('zapadmin.admin@example.test');

select set_config('request.jwt.claim.sub', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Lokal zapytań', 'Zapytanowo');
update public.lokale set opis = 'Opis', godziny_od = '10:00', godziny_do = '22:00'
 where nazwa = 'Lokal zapytań';
update public.sale s set nazwa = 'Sala', pojemnosc_max = 20
  from public.lokale l where s.lokal_id = l.id and l.nazwa = 'Lokal zapytań';
insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 15000, false
from public.sale s join public.lokale l on l.id = s.lokal_id
where l.nazwa = 'Lokal zapytań';
select public.wyslij_do_weryfikacji(id) from public.lokale where nazwa = 'Lokal zapytań';

reset role;
select set_config('request.jwt.claim.sub', 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3","role":"authenticated"}', true);
set local role authenticated;
select public.zatwierdz_lokal(id) from public.lokale where nazwa = 'Lokal zapytań';

reset role;
create temp table fx as
select
  (select id from public.lokale where nazwa = 'Lokal zapytań') as swoj,
  (select s.id from public.opublikowane_sale s
     join public.lokale l on l.id = s.lokal_id
    where l.nazwa = 'Lokal zapytań') as sala,
  (now() at time zone 'Europe/Warsaw')::date + 12 as dzien;
grant select on fx to anon, authenticated;

select set_config('request.jwt.claim.sub', 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2","role":"authenticated"}', true);
set local role authenticated;
select public.wyslij_zapytanie(
  swoj, sala, null, dzien, '15:00', 3,
  'Klient Test', '500600700', 'zapadmin-gosc@example.test', null
) from fx;

select throws_ok(
  $$ select public.ustaw_status_zapytania(z.id, 'anulowane')
       from public.zapytania z where z.email = 'zapadmin-gosc@example.test' $$,
  '42501',
  'Tylko administrator zmienia status zapytania.',
  'klient nie zmienia statusu'
);

reset role;
select set_config('request.jwt.claim.sub', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ select public.ustaw_status_zapytania(z.id, 'zaakceptowane')
       from public.zapytania z where z.email = 'zapadmin-gosc@example.test' $$,
  '42501',
  'Tylko administrator zmienia status zapytania.',
  'właściciel nie ustawia potwierdzenia tą funkcją'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$ select id from public.zapytania_zmiany $$,
  '42501',
  'permission denied for table zapytania_zmiany',
  'gość nie czyta śladu zmian'
);
select throws_ok(
  $$ select public.ustaw_status_zapytania('e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4', 'anulowane') $$,
  '42501',
  'permission denied for function ustaw_status_zapytania',
  'gość nie woła zmiany statusu'
);

reset role;
select is(
  (select kwota_szacunkowa from public.zapytania where email = 'zapadmin-gosc@example.test'),
  15000,
  'szacunek z cennika jest zapisany przed zmianą statusu'
);

select set_config('request.jwt.claim.sub', 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.ustaw_status_zapytania(z.id, 'anulowane')
       from public.zapytania z where z.email = 'zapadmin-gosc@example.test' $$,
  'administrator ustawia anulowane'
);

reset role;
select is(
  (select status::text from public.zapytania where email = 'zapadmin-gosc@example.test'),
  'anulowane',
  'status to anulowane'
);
select is(
  (select kwota_szacunkowa from public.zapytania where email = 'zapadmin-gosc@example.test'),
  15000,
  'zmiana statusu nie rusza kwoty'
);
select is(
  (select status_na::text from public.zapytania_zmiany where zapytanie_id = (
     select id from public.zapytania where email = 'zapadmin-gosc@example.test'
  )),
  'anulowane',
  'ślad zapisuje nowy status i nie ma kolumny płatności'
);
select ok(
  not (select private.czy_nachodzi(fx.swoj, fx.sala, o.start_o, o.koniec_o)
         from fx
         cross join lateral private.okres_warszawa(fx.dzien, '15:00', '16:00', null, null) o),
  'anulowane nie zajmuje sali'
);
select ok(
  (select pg_get_functiondef(p.oid) not like '%platn%'
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'ustaw_status_zapytania'),
  'funkcja statusu nie wspomina płatności'
);

select set_config('request.jwt.claim.sub', 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.ustaw_status_zapytania(z.id, 'zaakceptowane')
       from public.zapytania z where z.email = 'zapadmin-gosc@example.test' $$,
  'administrator oznacza ręcznie przyjęty termin'
);

reset role;
select set_config('app.allow_inquiry_change', '1', true);
update public.zapytania set wygasa_o = now() where email = 'zapadmin-gosc@example.test';
select set_config('app.allow_inquiry_change', '', true);
select ok(
  (select private.czy_nachodzi(fx.swoj, fx.sala, o.start_o, o.koniec_o)
     from fx
     cross join lateral private.okres_warszawa(fx.dzien, '15:00', '16:00', null, null) o),
  'przyjęty termin zajmuje salę także po czasie wygasa_o'
);
select is(
  (select kwota_szacunkowa from public.zapytania where email = 'zapadmin-gosc@example.test'),
  15000,
  'potwierdzenie terminu nie dopisuje zadatku'
);

select * from finish();
rollback;
