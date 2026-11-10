-- Współrzędne szkicu nie wchodzą do wyszukiwania. Pinezka jest tylko z migawki.
-- Uruchomienie: supabase test db

begin;

select plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'owner.one@example.test',
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
select public.utworz_lokal('Sala Z Mapa', 'Zielona Góra');

update public.lokale
   set opis = 'Opis testowy', lat = 51.935480, lng = 15.506430
 where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

update public.sale s
   set nazwa = 'Cały lokal', pojemnosc_max = 30
  from public.lokale l
 where s.lokal_id = l.id
   and l.wlasciciel_id = '11111111-1111-4111-8111-111111111111';

insert into public.ceny_sal (sala_id, waluta, jednostka, kwota_grosze, cena_na_zapytanie)
select s.id, 'PLN', 'za_sale', 240000, false
from public.sale s
join public.lokale l on l.id = s.lokal_id
where l.wlasciciel_id = '11111111-1111-4111-8111-111111111111';

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.szukaj_lokali('Zielona Góra', null, null, null, null, 'cena')),
  0::bigint,
  'szkic ze współrzędnymi nie wpada do wyszukiwania'
);

select throws_ok(
  'select lat from public.lokale',
  '42501',
  'permission denied for table lokale',
  'gość nie czyta współrzędnych szkicu'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select public.wyslij_do_weryfikacji(id)
from public.lokale
where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

select public.zatwierdz_lokal(id)
from public.lokale
where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.szukaj_lokali('Zielona Góra', null, null, null, null, 'cena')),
  1::bigint,
  'po publikacji lokal jest w wyniku'
);

select is(
  (select lat from public.szukaj_lokali('Zielona Góra', null, null, null, null, 'cena')),
  51.935480,
  'wyszukiwanie oddaje szerokość z migawki'
);

select is(
  (select lng from public.szukaj_lokali('Żary', null, null, null, null, 'cena') limit 1) is null,
  true,
  'filtr miasta nie zwraca pinezki z innego miasta'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

update public.lokale
   set lat = 52.100000
 where wlasciciel_id = '11111111-1111-4111-8111-111111111111';

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select lat from public.szukaj_lokali('Zielona Góra', null, null, null, null, 'cena')),
  51.935480,
  'edycja szkicu nie przesuwa opublikowanej pinezki'
);

select * from finish();
rollback;
