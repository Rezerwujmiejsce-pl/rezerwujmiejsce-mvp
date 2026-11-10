-- Właściciel wycofuje własny lokal z serwisu. Nie kasuje wiersza ani zapytań.
-- Zdejmuje migawkę publiczną, więc lokal znika z wyszukiwania, mapy i strony.
-- Nie wgrywać na DEV, dopóki operator nie wdroży tej jednej nowej wersji.
-- Wymaga historii co najmniej do 20261110092253. Nie rusza tamtych plików.

create or replace function private.wycofaj_wlasny_lokal(p_lokal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lokal is null or not private.jest_wlascicielem_lokalu(p_lokal) then
    raise exception 'Ten lokal możesz wycofać tylko jako jego właściciel.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lokale where id = p_lokal) then
    raise exception 'Nie ma takiego lokalu.' using errcode = '42501';
  end if;
  delete from public.lokal_publikacje where lokal_id = p_lokal;
  perform set_config('app.allow_status_change', '1', true);
  update public.lokale
     set status = 'archived',
         status_zgloszenia = 'none',
         ma_nieopublikowane_zmiany = false
   where id = p_lokal;
  perform set_config('app.allow_status_change', '', true);
end;
$$;

comment on function private.wycofaj_wlasny_lokal(uuid) is
  'Wycofanie własnego lokalu. Zostawia wiersz i zapytania. Nie przywraca publikacji i nie nadaje roli.';

create or replace function public.wycofaj_wlasny_lokal(p_lokal uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.wycofaj_wlasny_lokal(p_lokal);
end;
$$;

revoke all on function private.wycofaj_wlasny_lokal(uuid) from public, anon, authenticated, service_role;
revoke all on function public.wycofaj_wlasny_lokal(uuid) from public, anon, authenticated, service_role;
grant execute on function private.wycofaj_wlasny_lokal(uuid) to authenticated;
grant execute on function public.wycofaj_wlasny_lokal(uuid) to authenticated;
