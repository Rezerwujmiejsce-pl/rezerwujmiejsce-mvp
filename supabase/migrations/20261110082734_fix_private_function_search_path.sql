-- Ustawia search_path na funkcjach, które advisor oznaczył jako mutable.
-- Nie zmienia sygnatur, właściciela ani treści. Zależności (triggery, polityki,
-- inne funkcje) zostają, bo to ALTER FUNCTION ... SET, nie CREATE OR REPLACE.
--
-- Ciała używają tylko pg_catalog (lower, translate, trim, regexp_replace, now,
-- operator ~, rzutowanie na uuid) albo wywołań już kwalifikowanych
-- (private.zloz_tekst). Pusty search_path jest więc bezpieczny: pg_catalog
-- i tak jest przeszukiwany, a nic nie sięga do public po niekwalifikowanej nazwie.
--
-- Na DEV ta treść jest już zapisana jako wersja 20261110082734
-- (fix_private_function_search_path). Nie wgrywać jej drugi raz.
-- Plik inicjalny 20261107122010 też jest już na DEV.

alter function private.zloz_tekst(text) set search_path = '';
alter function private.zloz_miasto(text) set search_path = '';
alter function private.slugify(text) set search_path = '';
alter function private.uuid_albo_null(text) set search_path = '';
alter function private.dotknij() set search_path = '';
