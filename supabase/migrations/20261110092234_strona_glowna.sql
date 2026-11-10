-- Szkic i publikacja tekstu strony głównej oraz kolejności kafli okazji.
-- Na DEV ta wersja jest już wgrana jako 20261110092234 / strona_glowna.
-- Nie wgrywać drugi raz. Starszego prefiksu 20261110091752 nie dopisywać przez migration repair.
-- Pusta tabela znaczy: strona zostaje przy dotychczasowym tekście w aplikacji.
-- Nie wstawiamy tu przykładowej treści.

create table public.strona_szkic (
  id smallint primary key default 1,
  naglowek text not null,
  podtytul text not null,
  baner text not null,
  zmieniono timestamptz not null default now(),
  constraint strona_szkic_jeden check (id = 1),
  constraint strona_szkic_naglowek check (char_length(naglowek) between 2 and 120 and naglowek !~ '[<>]'),
  constraint strona_szkic_podtytul check (char_length(podtytul) between 2 and 400 and podtytul !~ '[<>]'),
  constraint strona_szkic_baner check (
    baner in ('/img/hero.webp', '/img/hero-800.jpg', '/img/sala-dworek.webp')
  )
);

create table public.strona_szkic_okazje (
  kod text primary key references public.okazje (kod),
  kolejnosc smallint not null,
  widoczna boolean not null,
  constraint strona_szkic_okazje_kolejnosc check (kolejnosc between 0 and 999)
);

create table public.strona_publikacja (
  id smallint primary key default 1,
  naglowek text not null,
  podtytul text not null,
  baner text not null,
  opublikowano_o timestamptz not null default now(),
  constraint strona_publikacja_jeden check (id = 1),
  constraint strona_publikacja_naglowek check (char_length(naglowek) between 2 and 120 and naglowek !~ '[<>]'),
  constraint strona_publikacja_podtytul check (char_length(podtytul) between 2 and 400 and podtytul !~ '[<>]'),
  constraint strona_publikacja_baner check (
    baner in ('/img/hero.webp', '/img/hero-800.jpg', '/img/sala-dworek.webp')
  )
);

create table public.strona_publikacja_okazje (
  kod text primary key references public.okazje (kod) on delete cascade,
  kolejnosc smallint not null,
  widoczna boolean not null,
  constraint strona_publikacja_okazje_kolejnosc check (kolejnosc between 0 and 999)
);

comment on table public.strona_szkic is
  'Szkic strony głównej. Gość go nie czyta. Pusty szkic nie zmienia publicznej strony.';
comment on table public.strona_publikacja is
  'Opublikowany tekst strony głównej. Brak wiersza znaczy dotychczasowy tekst aplikacji.';

alter table public.strona_szkic enable row level security;
alter table public.strona_szkic force row level security;
alter table public.strona_szkic_okazje enable row level security;
alter table public.strona_szkic_okazje force row level security;
alter table public.strona_publikacja enable row level security;
alter table public.strona_publikacja force row level security;
alter table public.strona_publikacja_okazje enable row level security;
alter table public.strona_publikacja_okazje force row level security;

create or replace function private.zapisz_strone(
  p_naglowek text,
  p_podtytul text,
  p_baner text,
  p_okazje jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_naglowek text := btrim(coalesce(p_naglowek, ''));
  v_podtytul text := btrim(coalesce(p_podtytul, ''));
  v_baner text := btrim(coalesce(p_baner, ''));
  v_item jsonb;
  v_kod text;
  v_kolejnosc integer;
  v_widoczna boolean;
begin
  if not private.jest_admin() then
    raise exception 'Stronę główną zmienia tylko administrator.' using errcode = '42501';
  end if;
  if char_length(v_naglowek) < 2 or char_length(v_naglowek) > 120 or v_naglowek ~ '[<>]' then
    raise exception 'Nagłówek ma mieć 2–120 znaków, bez znaczników HTML.';
  end if;
  if char_length(v_podtytul) < 2 or char_length(v_podtytul) > 400 or v_podtytul ~ '[<>]' then
    raise exception 'Podtytuł ma mieć 2–400 znaków, bez znaczników HTML.';
  end if;
  if v_baner not in ('/img/hero.webp', '/img/hero-800.jpg', '/img/sala-dworek.webp') then
    raise exception 'Baner wybierz z plików strony. Adres z internetu nie jest dozwolony.';
  end if;
  if p_okazje is null or jsonb_typeof(p_okazje) <> 'array' then
    raise exception 'Lista okazji jest nieprawidłowa.';
  end if;

  insert into public.strona_szkic (id, naglowek, podtytul, baner, zmieniono)
  values (1, v_naglowek, v_podtytul, v_baner, now())
  on conflict (id) do update
    set naglowek = excluded.naglowek,
        podtytul = excluded.podtytul,
        baner = excluded.baner,
        zmieniono = now();

  delete from public.strona_szkic_okazje;
  for v_item in select value from jsonb_array_elements(p_okazje) loop
    v_kod := btrim(coalesce(v_item ->> 'kod', ''));
    v_kolejnosc := (v_item ->> 'kolejnosc')::integer;
    v_widoczna := coalesce((v_item ->> 'widoczna')::boolean, true);
    if v_kod !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
      raise exception 'Nieznana okazja na stronie.';
    end if;
    if v_kolejnosc is null or v_kolejnosc < 0 or v_kolejnosc > 999 then
      raise exception 'Kolejność kafla ma być liczbą od 0 do 999.';
    end if;
    if not exists (select 1 from public.okazje o where o.kod = v_kod) then
      raise exception 'Nieznana okazja na stronie.';
    end if;
    insert into public.strona_szkic_okazje (kod, kolejnosc, widoczna)
    values (v_kod, v_kolejnosc, v_widoczna);
  end loop;
end;
$$;

create or replace function private.opublikuj_strone()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.strona_szkic%rowtype;
begin
  if not private.jest_admin() then
    raise exception 'Stronę główną publikuje tylko administrator.' using errcode = '42501';
  end if;
  select * into v from public.strona_szkic where id = 1;
  if not found then
    raise exception 'Najpierw zapisz szkic. Publiczna strona zostaje przy dotychczasowym tekście.';
  end if;
  insert into public.strona_publikacja (id, naglowek, podtytul, baner, opublikowano_o)
  values (1, v.naglowek, v.podtytul, v.baner, now())
  on conflict (id) do update
    set naglowek = excluded.naglowek,
        podtytul = excluded.podtytul,
        baner = excluded.baner,
        opublikowano_o = now();
  delete from public.strona_publikacja_okazje;
  insert into public.strona_publikacja_okazje (kod, kolejnosc, widoczna)
  select kod, kolejnosc, widoczna from public.strona_szkic_okazje;
end;
$$;

create or replace function public.zapisz_strone(
  p_naglowek text,
  p_podtytul text,
  p_baner text,
  p_okazje jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.zapisz_strone(p_naglowek, p_podtytul, p_baner, p_okazje);
end;
$$;

create or replace function public.opublikuj_strone()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.opublikuj_strone();
end;
$$;

revoke all on function private.zapisz_strone(text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.opublikuj_strone() from public, anon, authenticated, service_role;
revoke all on function public.zapisz_strone(text, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.opublikuj_strone() from public, anon, authenticated, service_role;
grant execute on function private.zapisz_strone(text, text, text, jsonb) to authenticated;
grant execute on function private.opublikuj_strone() to authenticated;
grant execute on function public.zapisz_strone(text, text, text, jsonb) to authenticated;
grant execute on function public.opublikuj_strone() to authenticated;

revoke all on table public.strona_szkic from public, anon, authenticated;
revoke all on table public.strona_szkic_okazje from public, anon, authenticated;
revoke all on table public.strona_publikacja from public, anon, authenticated;
revoke all on table public.strona_publikacja_okazje from public, anon, authenticated;

grant select on table public.strona_szkic to authenticated;
grant select on table public.strona_szkic_okazje to authenticated;
grant select on table public.strona_publikacja to anon, authenticated;
grant select on table public.strona_publikacja_okazje to anon, authenticated;

create policy strona_szkic_czytaj on public.strona_szkic
  for select to authenticated
  using (private.jest_admin());

create policy strona_szkic_okazje_czytaj on public.strona_szkic_okazje
  for select to authenticated
  using (private.jest_admin());

create policy strona_publikacja_czytaj on public.strona_publikacja
  for select to anon, authenticated
  using (true);

create policy strona_publikacja_okazje_czytaj on public.strona_publikacja_okazje
  for select to anon, authenticated
  using (true);
