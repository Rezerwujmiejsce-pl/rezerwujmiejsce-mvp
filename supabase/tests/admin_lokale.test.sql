-- Zawieszenie administratora chowa stronę i przywraca tylko schowaną migawkę.
-- Transakcja jest wycofywana. Nie zmienia danych DEV.

begin;

select plan(18);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  'authenticated', 'authenticated', 'zawies.a@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-0000-0000-000000000000',
  'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3',
  'authenticated', 'authenticated', 'zawies.admin@example.test',
  extensions.crypt('haslo-testowe', extensions.gen_salt('bf')),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

select private.bootstrap_admin('zawies.admin@example.test');
update public.profile set imie_nazwisko = 'Anna Właściciel'
 where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}', true);
set local role authenticated;
select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);
select public.utworz_lokal('Nazwa publiczna', 'Zawiesinowo');
select public.utworz_lokal('Sam szkic', 'Zawiesinowo');
update public.lokale set opis = 'Opis', godziny_od = '10:00', godziny_do = '22:00'
 where nazwa = 'Nazwa publiczna';
update public.sale s set nazwa = 'Sala', pojemnosc_max = 20
  from public.lokale l
 where s.lokal_id = l.id and l.nazwa = 'Nazwa publiczna';
insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 10000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.nazwa = 'Nazwa publiczna';
select public.wyslij_do_weryfikacji(id) from public.lokale where nazwa = 'Nazwa publiczna';

reset role;
select set_config('request.jwt.claim.sub', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3","role":"authenticated"}', true);
set local role authenticated;
select public.zatwierdz_lokal(id) from public.lokale where nazwa = 'Nazwa publiczna';

reset role;
create temp table fx as
select
  (select id from public.lokale where nazwa = 'Nazwa publiczna') as swoj,
  (select id from public.lokale where nazwa = 'Sam szkic') as szkic,
  (select s.id from public.opublikowane_sale s
     join public.lokale l on l.id = s.lokal_id
    where l.nazwa = 'Nazwa publiczna') as sala;
grant select on fx to anon, authenticated;

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'zawies_lokal'),
  false,
  'publiczne zawieszenie jest invoker'
);

select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.zawies_lokal(swoj) from fx $$,
  '42501',
  'Tylko administrator zawiesza lokal.',
  'właściciel nie zawiesza własnego lokalu'
);

reset role;
select set_config('request.jwt.claim.sub', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.zawies_lokal(szkic) from fx $$,
  'P0001',
  'Nie ma opublikowanej wersji do zdjęcia. Szkic zostaje szkicem.',
  'szkic bez publikacji nie staje się zawieszonym lokalem'
);
select lives_ok(
  $$ select public.zawies_lokal(swoj) from fx $$,
  'administrator zawiesza opublikowany lokal'
);

reset role;
select is(
  (select count(*) from public.lokal_publikacje p join fx on fx.swoj = p.lokal_id),
  0::bigint,
  'zawieszenie zdejmuje publiczną migawkę'
);
select is(
  (select nazwa from public.zawieszona_publikacja p join fx on fx.swoj = p.lokal_id),
  'Nazwa publiczna',
  'schowana migawka pamięta nazwę z publikacji'
);
select is(
  (select status::text from public.lokale l join fx on fx.swoj = l.id),
  'suspended',
  'status to zawieszony, nie szkic i nie wycofany'
);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  $$ select lokal_id from public.zawieszona_publikacja $$,
  '42501',
  'permission denied for table zawieszona_publikacja',
  'gość nie czyta schowanej migawki'
);
select is(
  (select count(*) from public.szukaj_lokali('Zawiesinowo', null, null, null, null, 'cena')),
  0::bigint,
  'zawieszony lokal wypada z wyszukiwarki'
);
select throws_ok(
  $$
    select public.wyslij_zapytanie(
      swoj, sala, null,
      (now() at time zone 'Europe/Warsaw')::date + 9,
      '14:00', 2, 'Gość Test', '500600700', 'zawies-gosc@example.test', null
    ) from fx
  $$,
  'P0001',
  'Ten lokal nie jest opublikowany.',
  'do zawieszonego lokalu nie wchodzi zapytanie'
);

reset role;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}', true);
set local role authenticated;

update public.lokale set nazwa = 'Szkic po zawieszeniu' where id = (select swoj from fx);
select throws_ok(
  $$ select public.wycofaj_wlasny_lokal(swoj) from fx $$,
  '42501',
  'Zawieszenie administratora zdejmuje tylko administrator.',
  'właściciel nie zdejmuje zawieszenia wycofaniem'
);
select throws_ok(
  $$ select public.przywroc_zawieszony_lokal(swoj) from fx $$,
  '42501',
  'Tylko administrator przywraca zawieszony lokal.',
  'właściciel nie przywraca strony'
);
select throws_ok(
  $$ select public.wyslij_do_weryfikacji(swoj) from fx $$,
  'P0001',
  'Tego lokalu nie można teraz wysłać.',
  'wysłanie szkicu nie zdejmuje zawieszenia'
);

reset role;
select set_config('request.jwt.claim.sub', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.przywroc_zawieszony_lokal(swoj) from fx $$,
  'administrator przywraca poprzednią publikację'
);

reset role;
select is(
  (select nazwa from public.lokal_publikacje p join fx on fx.swoj = p.lokal_id),
  'Nazwa publiczna',
  'na stronie wraca nazwa z publikacji, nie ze szkicu'
);
select is(
  (select nazwa from public.lokale l join fx on fx.swoj = l.id),
  'Szkic po zawieszeniu',
  'szkic właściciela zostaje w wierszu roboczym'
);
select is(
  (select status::text from public.lokale l join fx on fx.swoj = l.id),
  'published',
  'po przywróceniu lokal jest znowu opublikowany'
);
select is(
  (select count(*) from public.zawieszona_publikacja p join fx on fx.swoj = p.lokal_id),
  0::bigint,
  'schowana migawka znika po przywróceniu'
);

select * from finish();
rollback;
