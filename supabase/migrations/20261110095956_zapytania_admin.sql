-- Lista i zmiana statusu zapytań dla administratora.
-- „zaakceptowane” to ręcznie przyjęty termin, nie płatność.
-- „anulowane” nie zajmuje sali. Zmiana statusu nie tworzy wpłaty i nie wysyła wiadomości.
-- Nie wgrywać na DEV z tego środowiska. Po 20261110095347.

alter type public.status_zapytania add value if not exists 'anulowane';

create table public.zapytania_zmiany (
  id uuid primary key default gen_random_uuid(),
  zapytanie_id uuid not null references public.zapytania (id) on delete cascade,
  status_z public.status_zapytania not null,
  status_na public.status_zapytania not null,
  zmienil uuid references public.profile (id),
  zmieniono timestamptz not null default now()
);

comment on table public.zapytania_zmiany is
  'Ślad zmiany statusu zapytania. Nie ma tu kwoty, zadatku ani wysyłki.';

alter table public.zapytania_zmiany enable row level security;
alter table public.zapytania_zmiany force row level security;
revoke all on table public.zapytania_zmiany from public, anon, authenticated;
grant select on table public.zapytania_zmiany to authenticated;

create policy zapytania_zmiany_czytaj on public.zapytania_zmiany
  for select to authenticated
  using ((select private.jest_admin()));

create or replace function private.ustaw_status_zapytania(
  p_id uuid,
  p_status public.status_zapytania
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.status_zapytania;
begin
  if not private.jest_admin() then
    raise exception 'Tylko administrator zmienia status zapytania.' using errcode = '42501';
  end if;
  if p_status is null then
    raise exception 'Wybierz status z listy.';
  end if;
  if p_status::text not in (
    'nowe', 'inny_termin', 'odrzucone', 'wygasle', 'zaakceptowane', 'anulowane'
  ) then
    raise exception 'Wybierz status z listy.';
  end if;
  select status into v_status from public.zapytania where id = p_id;
  if not found then
    raise exception 'Nie ma takiego zapytania.';
  end if;
  if v_status = p_status then
    raise exception 'Ten status już jest ustawiony.';
  end if;
  perform set_config('app.allow_inquiry_change', '1', true);
  update public.zapytania
     set status = p_status,
         zmieniono = now()
   where id = p_id;
  perform set_config('app.allow_inquiry_change', '', true);
  insert into public.zapytania_zmiany (zapytanie_id, status_z, status_na, zmienil)
  values (p_id, v_status, p_status, auth.uid());
end;
$$;

comment on function private.ustaw_status_zapytania(uuid, public.status_zapytania) is
  'Zmiana statusu przez administratora. Nie rusza kwoty, nie tworzy płatności i nie wysyła wiadomości.';

create or replace function public.ustaw_status_zapytania(
  p_id uuid,
  p_status public.status_zapytania
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.ustaw_status_zapytania(p_id, p_status);
end;
$$;

revoke all on function private.ustaw_status_zapytania(uuid, public.status_zapytania) from public, anon, authenticated, service_role;
revoke all on function public.ustaw_status_zapytania(uuid, public.status_zapytania) from public, anon, authenticated, service_role;
grant execute on function private.ustaw_status_zapytania(uuid, public.status_zapytania) to authenticated;
grant execute on function public.ustaw_status_zapytania(uuid, public.status_zapytania) to authenticated;
