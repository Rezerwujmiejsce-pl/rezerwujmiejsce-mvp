-- Szkic strony głównej jest prywatny. Publikacja jest osobnym, jawnym krokiem.
-- Uruchomienie: supabase test db

begin;

select plan(13);

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

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok(
  'select count(*) from public.strona_szkic',
  '42501',
  'permission denied for table strona_szkic',
  'gość nie czyta szkicu strony'
);

select throws_ok(
  $$ select public.zapisz_strone('Nagłówek', 'Podtytuł strony', '/img/hero.webp', '[]'::jsonb) $$,
  '42501',
  'permission denied for function zapisz_strone',
  'gość nie zapisuje strony'
);

select is(
  (select count(*) from public.strona_publikacja),
  0::bigint,
  'bez publikacji gość nie dostaje nowego tekstu'
);

reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select public.zostan_wlascicielem();
select set_config('app.allow_role_change', '', true);

select throws_ok(
  $$ select public.zapisz_strone('Nagłówek', 'Podtytuł strony', '/img/hero.webp', '[]'::jsonb) $$,
  '42501',
  'Stronę główną zmienia tylko administrator.',
  'właściciel nie zapisuje strony'
);

select is(
  (select count(*) from public.strona_szkic),
  0::bigint,
  'właściciel nie widzi szkicu strony'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.zapisz_strone('<b>x</b>', 'Podtytuł strony', '/img/hero.webp', '[]'::jsonb) $$,
  'P0001',
  'Nagłówek ma mieć 2–120 znaków, bez znaczników HTML.',
  'znaczniki HTML odpadają'
);

select throws_ok(
  $$ select public.zapisz_strone('Nagłówek', 'Podtytuł strony', 'https://evil.example/a.webp', '[]'::jsonb) $$,
  'P0001',
  'Baner wybierz z plików strony. Adres z internetu nie jest dozwolony.',
  'obcy adres banera odpada'
);

select lives_ok(
  $$
    select public.zapisz_strone(
      'Nagłówek ze szkicu',
      'Ten podtytuł jest tylko w szkicu.',
      '/img/hero.webp',
      '[{"kod":"urodziny","kolejnosc":1,"widoczna":false}]'::jsonb
    )
  $$,
  'administrator zapisuje szkic'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select count(*) from public.strona_publikacja),
  0::bigint,
  'zapis szkicu nie publikuje tekstu'
);

reset role;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select lives_ok('select public.opublikuj_strone()', 'administrator publikuje szkic');

select lives_ok(
  $$
    select public.zapisz_strone(
      'Nagłówek nadal w szkicu',
      'Ten podtytuł nie wszedł na stronę.',
      '/img/sala-dworek.webp',
      '[{"kod":"urodziny","kolejnosc":1,"widoczna":true}]'::jsonb
    )
  $$,
  'kolejny szkic nie jest jeszcze publikacją'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is(
  (select naglowek from public.strona_publikacja),
  'Nagłówek ze szkicu',
  'gość widzi ostatnią publikację, nie późniejszy szkic'
);

select is(
  (select widoczna from public.strona_publikacja_okazje where kod = 'urodziny'),
  false,
  'gość dostaje opublikowaną widoczność kafla'
);

select * from finish();
rollback;
