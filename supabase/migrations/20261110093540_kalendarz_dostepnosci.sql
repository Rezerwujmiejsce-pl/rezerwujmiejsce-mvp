-- Dostępność wybranego lokalu. Nie ma cen dnia, pakietów ani płatnych rezerwacji.
-- Zapytanie „nowe” zajmuje salę do odrzucenia. Nie wygasa samo po 24 h.
-- Odrzucone, wygasłe i „inny termin” nie blokują. „Zaakceptowane” znaczy ręcznie przyjęty termin,
-- nie opłaconą rezerwację. Ta funkcja go nie ustawia.
-- Nie wgrywać na DEV z tego środowiska. Po 20261110092253.

create table public.blokady_terminu (
  id uuid primary key default gen_random_uuid(),
  lokal_id uuid not null references public.lokale (id) on delete cascade,
  sala_id uuid references public.sale (id) on delete cascade,
  dzien date not null,
  godzina_od time,
  godzina_do time,
  start_o timestamptz not null,
  koniec_o timestamptz not null,
  notatka text,
  utworzyl uuid references public.profile (id),
  utworzono timestamptz not null default now(),
  constraint blokady_kolejnosc check (koniec_o > start_o),
  constraint blokady_notatka check (notatka is null or (char_length(notatka) <= 200 and notatka !~ '[<>]')),
  constraint blokady_godziny_para check ((godzina_od is null) = (godzina_do is null))
);

comment on table public.blokady_terminu is
  'Blokada właściciela. sala_id puste = cały lokal. Gość tej tabeli nie czyta.';

create index blokady_lokal_czas on public.blokady_terminu (lokal_id, start_o, koniec_o);

alter table public.blokady_terminu enable row level security;
alter table public.blokady_terminu force row level security;
revoke all on table public.blokady_terminu from public, anon, authenticated;
grant select on table public.blokady_terminu to authenticated;

create policy blokady_czytaj on public.blokady_terminu
  for select to authenticated
  using (private.jest_czlonkiem(lokal_id) or (select private.jest_admin()));

create or replace function private.okres_warszawa(
  p_dzien date,
  p_od time,
  p_do time,
  p_godziny_od time,
  p_godziny_do time
) returns table (start_o timestamptz, koniec_o timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_od time;
  v_start timestamptz;
  v_koniec timestamptz;
  v_lokal_start timestamp;
  v_lokal_koniec timestamp;
begin
  if p_dzien is null then
    raise exception 'Podaj dzień.';
  end if;
  if p_od is null and p_do is null then
    v_od := coalesce(p_godziny_od, time '00:00');
    v_lokal_start := p_dzien + v_od;
    if p_godziny_do is null or p_godziny_do = v_od then
      v_lokal_koniec := (p_dzien + 1) + time '00:00';
    elsif p_godziny_do > v_od then
      v_lokal_koniec := p_dzien + p_godziny_do;
    else
      v_lokal_koniec := (p_dzien + 1) + p_godziny_do;
    end if;
  elsif p_od is null or p_do is null then
    raise exception 'Podaj obie godziny albo zostaw obie puste na cały dzień w godzinach lokalu.';
  else
    v_lokal_start := p_dzien + p_od;
    if p_do > p_od then
      v_lokal_koniec := p_dzien + p_do;
    else
      v_lokal_koniec := (p_dzien + 1) + p_do;
    end if;
  end if;
  v_start := timezone('Europe/Warsaw', v_lokal_start);
  v_koniec := timezone('Europe/Warsaw', v_lokal_koniec);
  -- Godzina, której w tym dniu nie ma (wiosenna luka), po konwersji nie wraca do wpisanej.
  -- Jesienne powtórzenie bierze tę stronę, którą zwraca PostgreSQL i która przechodzi ten test.
  if v_koniec is null or v_start is null or v_koniec <= v_start
     or (v_start at time zone 'Europe/Warsaw') is distinct from v_lokal_start
     or (v_koniec at time zone 'Europe/Warsaw') is distinct from v_lokal_koniec then
    raise exception 'Ten przedział nie mieści się w kalendarzu Europy/Warszawy.';
  end if;
  return query select v_start, v_koniec;
end;
$$;

create or replace function private.czy_nachodzi(
  p_lokal uuid,
  p_sala uuid,
  p_start timestamptz,
  p_koniec timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blokady_terminu b
    where b.lokal_id = p_lokal
      and b.start_o < p_koniec
      and p_start < b.koniec_o
      and (p_sala is null or b.sala_id is null or b.sala_id = p_sala)
  )
  or exists (
    select 1
    from public.zapytania z
    join public.lokale l on l.id = z.lokal_id
    left join public.lokal_publikacje lp on lp.lokal_id = l.id
    cross join lateral private.okres_warszawa(
      z.data,
      z.godzina_od,
      case
        when coalesce(lp.godziny_do, l.godziny_do) is not null
          and coalesce(lp.godziny_do, l.godziny_do) > z.godzina_od
          then coalesce(lp.godziny_do, l.godziny_do)
        when coalesce(lp.godziny_do, l.godziny_do) is not null
          and coalesce(lp.godziny_od, l.godziny_od) is not null
          and coalesce(lp.godziny_do, l.godziny_do) <= coalesce(lp.godziny_od, l.godziny_od)
          and z.godzina_od >= coalesce(lp.godziny_od, l.godziny_od)
          then coalesce(lp.godziny_do, l.godziny_do)
        else (z.godzina_od + interval '2 hours')::time
      end,
      coalesce(lp.godziny_od, l.godziny_od),
      coalesce(lp.godziny_do, l.godziny_do)
    ) o
    where z.lokal_id = p_lokal
      and z.status in ('nowe', 'zaakceptowane')
      and o.start_o < p_koniec
      and p_start < o.koniec_o
      and (p_sala is null or z.sala_id = p_sala)
  );
$$;

create or replace function private.dodaj_blokade(
  p_lokal uuid,
  p_sala uuid,
  p_dzien date,
  p_od time,
  p_do time,
  p_notatka text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_start timestamptz;
  v_koniec timestamptz;
  v_godziny_od time;
  v_godziny_do time;
  v_notatka text := nullif(btrim(coalesce(p_notatka, '')), '');
begin
  if not private.jest_wlascicielem_lokalu(p_lokal) then
    raise exception 'Terminy blokuje właściciel tego lokalu.' using errcode = '42501';
  end if;
  if p_sala is not null and not exists (
    select 1 from public.sale s where s.id = p_sala and s.lokal_id = p_lokal
  ) then
    raise exception 'Ta sala nie należy do tego lokalu.' using errcode = '42501';
  end if;
  if v_notatka is not null and (char_length(v_notatka) > 200 or v_notatka ~ '[<>]') then
    raise exception 'Notatka może mieć do 200 znaków, bez znaczników HTML.';
  end if;
  if p_dzien < (now() at time zone 'Europe/Warsaw')::date - 1
     or p_dzien > (now() at time zone 'Europe/Warsaw')::date + 540 then
    raise exception 'Dzień jest poza dozwolonym zakresem.';
  end if;
  select coalesce(lp.godziny_od, l.godziny_od), coalesce(lp.godziny_do, l.godziny_do)
    into v_godziny_od, v_godziny_do
  from public.lokale l
  left join public.lokal_publikacje lp on lp.lokal_id = l.id
  where l.id = p_lokal;
  select o.start_o, o.koniec_o into v_start, v_koniec
  from private.okres_warszawa(p_dzien, p_od, p_do, v_godziny_od, v_godziny_do) o;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-lokal:' || p_lokal::text, 0));
  if private.czy_nachodzi(p_lokal, p_sala, v_start, v_koniec) then
    raise exception 'Ten przedział nachodzi na blokadę albo zapytanie. Nie oznaczam go jako wolny i niczego nie odwołuję.';
  end if;
  insert into public.blokady_terminu (
    lokal_id, sala_id, dzien, godzina_od, godzina_do, start_o, koniec_o, notatka, utworzyl
  ) values (
    p_lokal, p_sala, p_dzien, p_od, p_do, v_start, v_koniec, v_notatka, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.usun_blokade(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lokal uuid;
begin
  select lokal_id into v_lokal from public.blokady_terminu where id = p_id;
  if not found or not private.jest_wlascicielem_lokalu(v_lokal) then
    raise exception 'Tej blokady nie usuniesz.' using errcode = '42501';
  end if;
  delete from public.blokady_terminu where id = p_id;
end;
$$;

create or replace function private.pasek_dostepnosci(p_lokal uuid, p_od date, p_do date)
returns table (dzien date, stan text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dzien date;
  v_wolne boolean;
  v_sala uuid;
  v_start timestamptz;
  v_koniec timestamptz;
  v_godziny_od time;
  v_godziny_do time;
begin
  if p_od is null or p_do is null or p_do < p_od or (p_do - p_od) > 41 then
    raise exception 'Podaj zakres co najwyżej 42 dni.';
  end if;
  if not exists (
    select 1 from public.lokal_publikacje p
    join public.lokale l on l.id = p.lokal_id
    where p.lokal_id = p_lokal and l.status = 'published'
  ) then
    return;
  end if;
  select lp.godziny_od, lp.godziny_do into v_godziny_od, v_godziny_do
  from public.lokal_publikacje lp where lp.lokal_id = p_lokal;
  v_dzien := p_od;
  while v_dzien <= p_do loop
    if exists (
      select 1 from public.dostepnosc_rezerwacji d
      where d.lokal_id = p_lokal and d.wstrzymane
    ) then
      dzien := v_dzien;
      stan := 'wstrzymane';
      return next;
    else
      v_wolne := false;
      for v_sala in
        select s.id from public.opublikowane_sale s where s.lokal_id = p_lokal
      loop
        select o.start_o, o.koniec_o into v_start, v_koniec
        from private.okres_warszawa(v_dzien, null, null, v_godziny_od, v_godziny_do) o;
        if not private.czy_nachodzi(p_lokal, v_sala, v_start, v_koniec) then
          v_wolne := true;
        end if;
      end loop;
      dzien := v_dzien;
      stan := case when v_wolne then 'wolne' else 'zajete' end;
      return next;
    end if;
    v_dzien := v_dzien + 1;
  end loop;
end;
$$;

create or replace function private.dodaj_blokady_dni(
  p_lokal uuid,
  p_sala uuid,
  p_dni date[],
  p_od time,
  p_do time,
  p_notatka text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dzien date;
  v_n integer := 0;
begin
  if coalesce(array_length(p_dni, 1), 0) < 1 or array_length(p_dni, 1) > 16 then
    raise exception 'Wybierz od 1 do 16 dni.';
  end if;
  foreach v_dzien in array p_dni loop
    perform private.dodaj_blokade(p_lokal, p_sala, v_dzien, p_od, p_do, p_notatka);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function private.oznacz_przedzial_wolny(
  p_lokal uuid,
  p_sala uuid,
  p_dzien date,
  p_od time,
  p_do time
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_koniec timestamptz;
  v_godziny_od time;
  v_godziny_do time;
  v_n integer;
begin
  if not private.jest_wlascicielem_lokalu(p_lokal) then
    raise exception 'Ten przedział zwalnia tylko właściciel lokalu.' using errcode = '42501';
  end if;
  if p_sala is not null and not exists (
    select 1 from public.sale s where s.id = p_sala and s.lokal_id = p_lokal
  ) then
    raise exception 'Ta sala nie należy do tego lokalu.' using errcode = '42501';
  end if;
  select coalesce(lp.godziny_od, l.godziny_od), coalesce(lp.godziny_do, l.godziny_do)
    into v_godziny_od, v_godziny_do
  from public.lokale l
  left join public.lokal_publikacje lp on lp.lokal_id = l.id
  where l.id = p_lokal;
  select o.start_o, o.koniec_o into v_start, v_koniec
  from private.okres_warszawa(p_dzien, p_od, p_do, v_godziny_od, v_godziny_do) o;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-lokal:' || p_lokal::text, 0));
  if exists (
    select 1
    from public.zapytania z
    join public.lokale l on l.id = z.lokal_id
    left join public.lokal_publikacje lp on lp.lokal_id = l.id
    cross join lateral private.okres_warszawa(
      z.data,
      z.godzina_od,
      case
        when coalesce(lp.godziny_do, l.godziny_do) is not null
          and coalesce(lp.godziny_do, l.godziny_do) > z.godzina_od
          then coalesce(lp.godziny_do, l.godziny_do)
        when coalesce(lp.godziny_do, l.godziny_do) is not null
          and coalesce(lp.godziny_od, l.godziny_od) is not null
          and coalesce(lp.godziny_do, l.godziny_do) <= coalesce(lp.godziny_od, l.godziny_od)
          and z.godzina_od >= coalesce(lp.godziny_od, l.godziny_od)
          then coalesce(lp.godziny_do, l.godziny_do)
        else (z.godzina_od + interval '2 hours')::time
      end,
      coalesce(lp.godziny_od, l.godziny_od),
      coalesce(lp.godziny_do, l.godziny_do)
    ) o
    where z.lokal_id = p_lokal
      and z.status in ('nowe', 'zaakceptowane')
      and o.start_o < v_koniec
      and v_start < o.koniec_o
      and (p_sala is null or z.sala_id = p_sala)
  ) then
    raise exception 'Nie oznaczam zajętego przedziału jako wolny. Zapytanie zostaje, nic nie odwołuję.';
  end if;
  if p_sala is not null and exists (
    select 1 from public.blokady_terminu b
    where b.lokal_id = p_lokal
      and b.sala_id is null
      and b.start_o < v_koniec
      and v_start < b.koniec_o
  ) then
    raise exception 'Nie zwalniam jednej sali, gdy blokada obejmuje cały lokal. Nic nie usuwam.';
  end if;
  delete from public.blokady_terminu b
  where b.lokal_id = p_lokal
    and b.start_o < v_koniec
    and v_start < b.koniec_o
    and (p_sala is null or b.sala_id = p_sala);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.oznacz_przedzial_wolny(
  p_lokal uuid, p_sala uuid, p_dzien date, p_od time, p_do time
) returns integer
language plpgsql security invoker set search_path = ''
as $$
begin
  return private.oznacz_przedzial_wolny(p_lokal, p_sala, p_dzien, p_od, p_do);
end;
$$;

create or replace function public.dodaj_blokady_dni(
  p_lokal uuid, p_sala uuid, p_dni date[], p_od time, p_do time, p_notatka text
) returns integer
language plpgsql security invoker set search_path = ''
as $$
begin
  return private.dodaj_blokady_dni(p_lokal, p_sala, p_dni, p_od, p_do, p_notatka);
end;
$$;

create or replace function public.dodaj_blokade(
  p_lokal uuid, p_sala uuid, p_dzien date, p_od time, p_do time, p_notatka text
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
begin
  return private.dodaj_blokade(p_lokal, p_sala, p_dzien, p_od, p_do, p_notatka);
end;
$$;

create or replace function public.usun_blokade(p_id uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  perform private.usun_blokade(p_id);
end;
$$;

create or replace function public.pasek_dostepnosci(p_lokal uuid, p_od date, p_do date)
returns table (dzien date, stan text)
language sql stable security invoker set search_path = ''
as $$
  select * from private.pasek_dostepnosci(p_lokal, p_od, p_do);
$$;

revoke all on function private.okres_warszawa(date, time, time, time, time) from public, anon, authenticated, service_role;
revoke all on function private.czy_nachodzi(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.dodaj_blokade(uuid, uuid, date, time, time, text) from public, anon, authenticated, service_role;
revoke all on function private.usun_blokade(uuid) from public, anon, authenticated, service_role;
revoke all on function private.pasek_dostepnosci(uuid, date, date) from public, anon, authenticated, service_role;
revoke all on function private.oznacz_przedzial_wolny(uuid, uuid, date, time, time) from public, anon, authenticated, service_role;
revoke all on function public.oznacz_przedzial_wolny(uuid, uuid, date, time, time) from public, anon, authenticated, service_role;
revoke all on function private.dodaj_blokady_dni(uuid, uuid, date[], time, time, text) from public, anon, authenticated, service_role;
revoke all on function public.dodaj_blokady_dni(uuid, uuid, date[], time, time, text) from public, anon, authenticated, service_role;
revoke all on function public.dodaj_blokade(uuid, uuid, date, time, time, text) from public, anon, authenticated, service_role;
revoke all on function public.usun_blokade(uuid) from public, anon, authenticated, service_role;
revoke all on function public.pasek_dostepnosci(uuid, date, date) from public, anon, authenticated, service_role;

grant execute on function private.dodaj_blokade(uuid, uuid, date, time, time, text) to authenticated;
grant execute on function private.oznacz_przedzial_wolny(uuid, uuid, date, time, time) to authenticated;
grant execute on function public.oznacz_przedzial_wolny(uuid, uuid, date, time, time) to authenticated;
grant execute on function private.usun_blokade(uuid) to authenticated;
grant execute on function private.pasek_dostepnosci(uuid, date, date) to anon, authenticated;
grant execute on function private.dodaj_blokady_dni(uuid, uuid, date[], time, time, text) to authenticated;
grant execute on function public.dodaj_blokady_dni(uuid, uuid, date[], time, time, text) to authenticated;
grant execute on function public.dodaj_blokade(uuid, uuid, date, time, time, text) to authenticated;
grant execute on function public.usun_blokade(uuid) to authenticated;
grant execute on function public.pasek_dostepnosci(uuid, date, date) to anon, authenticated;

-- To samo ciało co w 20261110092741 plus odmowa terminu nachodzącego na blokadę
-- albo na zapytanie „nowe” / „zaakceptowane”. GRANT-y z 20261110091341 zostają.
create or replace function private.wyslij_zapytanie(
  p_lokal uuid,
  p_sala uuid,
  p_okazja text,
  p_data date,
  p_godzina time,
  p_goscie integer,
  p_imie text,
  p_telefon text,
  p_email text,
  p_wiadomosc text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_okazja text := nullif(btrim(coalesce(p_okazja, '')), '');
  v_imie text := btrim(coalesce(p_imie, ''));
  v_telefon text := btrim(coalesce(p_telefon, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_wiadomosc text := nullif(btrim(coalesce(p_wiadomosc, '')), '');
  v_pojemnosc integer;
  v_grosze integer;
  v_na_zapytanie boolean;
  v_jednostka text;
  v_kwota integer;
  v_uid uuid := auth.uid();
  v_dzis date := (now() at time zone 'Europe/Warsaw')::date;
  v_start timestamptz;
  v_koniec timestamptz;
  v_godziny_od time;
  v_godziny_do time;
begin
  if p_lokal is null or p_sala is null or p_data is null or p_godzina is null then
    raise exception 'Uzupełnij lokal, salę, datę i godzinę.';
  end if;
  if p_goscie is null or p_goscie < 1 or p_goscie > 5000 then
    raise exception 'Podaj liczbę gości od 1 do 5000.';
  end if;
  if char_length(v_imie) < 2 or char_length(v_imie) > 120 then
    raise exception 'Podaj imię i nazwisko (2–120 znaków).';
  end if;
  if char_length(v_telefon) < 7 or char_length(v_telefon) > 32
     or v_telefon !~ '^[0-9 +()-]+$' then
    raise exception 'Podaj numer telefonu.';
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 200
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Podaj adres e-mail.';
  end if;
  if v_wiadomosc is not null and char_length(v_wiadomosc) > 2000 then
    raise exception 'Wiadomość może mieć najwyżej 2000 znaków.';
  end if;
  if p_data < v_dzis or p_data > v_dzis + 540 then
    raise exception 'Data musi być dzisiaj albo w ciągu najbliższych 18 miesięcy.';
  end if;
  if v_okazja is not null and v_okazja !~ '^[a-z0-9_]{2,40}$' then
    raise exception 'Wybierz okazję z listy.';
  end if;

  if not exists (
    select 1 from public.lokal_publikacje where lokal_id = p_lokal
  ) then
    raise exception 'Ten lokal nie jest opublikowany.';
  end if;

  select s.pojemnosc_max, s.kwota_grosze, s.cena_na_zapytanie, s.jednostka_ceny::text
    into v_pojemnosc, v_grosze, v_na_zapytanie, v_jednostka
  from public.opublikowane_sale s
  where s.id = p_sala
    and s.lokal_id = p_lokal;

  if not found then
    raise exception 'Wybierz salę z opublikowanego opisu tego lokalu.';
  end if;
  if p_goscie > v_pojemnosc then
    raise exception 'Ta sala nie mieści tylu gości.';
  end if;

  if v_okazja is not null and not exists (
    select 1 from public.opublikowane_okazje o
    where o.lokal_id = p_lokal and o.kod = v_okazja
  ) then
    raise exception 'Ten lokal nie ma takiej okazji w opublikowanym opisie.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-email:' || lower(v_email), 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('zapytanie-lokal:' || p_lokal::text, 0));

  if exists (
    select 1 from public.dostepnosc_rezerwacji d
    where d.lokal_id = p_lokal and d.wstrzymane
  ) then
    raise exception 'Ten lokal chwilowo nie przyjmuje rezerwacji. Zapytanie nie zostało zapisane.';
  end if;

  select coalesce(lp.godziny_od, l.godziny_od), coalesce(lp.godziny_do, l.godziny_do)
    into v_godziny_od, v_godziny_do
  from public.lokale l
  left join public.lokal_publikacje lp on lp.lokal_id = l.id
  where l.id = p_lokal;
  select o.start_o, o.koniec_o into v_start, v_koniec
  from private.okres_warszawa(
    p_data,
    p_godzina,
    case
      when v_godziny_do is not null and v_godziny_do > p_godzina then v_godziny_do
      when v_godziny_do is not null and v_godziny_od is not null
        and v_godziny_do <= v_godziny_od and p_godzina >= v_godziny_od then v_godziny_do
      else (p_godzina + interval '2 hours')::time
    end,
    v_godziny_od,
    v_godziny_do
  ) o;
  if private.czy_nachodzi(p_lokal, p_sala, v_start, v_koniec) then
    raise exception 'Ten termin jest już zajęty. Zapytanie nie zostało zapisane.';
  end if;

  if (
    select count(*) from public.zapytania
    where lower(email) = lower(v_email)
      and utworzono > now() - interval '1 hour'
  ) >= 8 then
    raise exception 'Za dużo zapytań z tego adresu w krótkim czasie. Spróbuj później.';
  end if;
  if (
    select count(*) from public.zapytania
    where lokal_id = p_lokal
      and utworzono > now() - interval '1 hour'
  ) >= 40 then
    raise exception 'Ten lokal dostał już dużo zapytań w tej godzinie. Spróbuj później.';
  end if;

  v_kwota := null;
  if not v_na_zapytanie and v_grosze is not null and v_grosze >= 0 then
    if v_jednostka = 'za_osobe' then
      if v_grosze::numeric * p_goscie <= 2000000000 then
        v_kwota := v_grosze * p_goscie;
      end if;
    elsif v_jednostka = 'za_sale' then
      v_kwota := v_grosze;
    end if;
  end if;

  perform set_config('app.allow_inquiry_change', '1', true);
  insert into public.zapytania (
    lokal_id, sala_id, klient_id, okazja_kod, data, godzina_od, liczba_gosci,
    imie_nazwisko, telefon, email, wiadomosc, status, kwota_szacunkowa, zrodlo
  ) values (
    p_lokal, p_sala, v_uid, v_okazja, p_data, p_godzina, p_goscie,
    v_imie, v_telefon, v_email, v_wiadomosc, 'nowe', v_kwota, 'strona_lokalu'
  )
  returning id into v_id;
  perform set_config('app.allow_inquiry_change', '', true);
  return v_id;
end;
$$;
