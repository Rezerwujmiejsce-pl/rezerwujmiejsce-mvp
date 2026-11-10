-- Potwierdzenie zapisu zapytania bez identyfikatora w adresie.
-- Wymaga wcześniejszej migracji 20261110091341_zapytania_o_termin, już wgranej na DEV.
-- Nie wgrywać na DEV razem ze starymi plikami i nie powtarzać po pierwszym wdrożeniu.
-- Nie stosować zdalnie z tego środowiska.

create or replace function private.czy_swieze_zapytanie(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_id is not null and exists (
    select 1
    from public.zapytania z
    where z.id = p_id
      and z.utworzono > now() - interval '10 minutes'
      and (z.klient_id is null or z.klient_id = auth.uid())
  );
$$;

comment on function private.czy_swieze_zapytanie(uuid) is
  'Czy to świeży zapis tej sesji. Nie zwraca treści, e-maila ani telefonu.';

create or replace function public.czy_swieze_zapytanie(p_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.czy_swieze_zapytanie(p_id);
$$;

revoke all on function private.czy_swieze_zapytanie(uuid) from public, anon, authenticated, service_role;
revoke all on function public.czy_swieze_zapytanie(uuid) from public, anon, authenticated, service_role;
grant execute on function private.czy_swieze_zapytanie(uuid) to anon, authenticated;
grant execute on function public.czy_swieze_zapytanie(uuid) to anon, authenticated;
