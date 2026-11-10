# Uruchomienie lokalne

Potrzebne: Node.js 22, Docker i [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). W tym repozytorium CLI w wersji 2.72 było używane do `supabase start` i testów.

## 1. Baza

W katalogu projektu:

```bash
supabase start
```

Pierwsze uruchomienie ściąga obrazy Dockera i trwa dłużej. Na końcu CLI wypisuje adres API i klucze. To klucze **tylko tej lokalnej** bazy.

Zatrzymanie: `supabase stop`.

## 2. Plik środowiskowy

```bash
cp .env.example .env.local
```

Wklej do `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` — zwykle `http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — wartość `ANON_KEY` z `supabase status -o env`

Klucz `SERVICE_ROLE_KEY` wklej tylko wtedy, gdy będziesz nadawać administratora skryptem. Nie dodawaj mu przedrostka `NEXT_PUBLIC_`. Plik `.env.local` nie trafia do gita.

Bez tych dwóch publicznych zmiennych strona pokazuje komunikat o braku konfiguracji. Nie zmyśla listy lokali.

## 3. Strona

```bash
npm install
npm run dev
```

Otwórz [http://127.0.0.1:3000](http://127.0.0.1:3000).

Logowanie e-mailem i hasłem działa od razu, bo w `supabase/config.toml` lokalnie wyłączone jest potwierdzanie skrzynki (`enable_confirmations = false`). To ustawienie dotyczy tylko bazy na Twoim komputerze. Przed prawdziwym startem włącz potwierdzanie adresu w projekcie Supabase.

Poczta testowa, gdy potwierdzanie włączysz lokalnie, jest w Inbucket: zwykle [http://127.0.0.1:54324](http://127.0.0.1:54324).

## 4. Dane przykładowe (opcjonalnie)

Słownik okazji i udogodnień jest w migracji. Lokali przykładowych migracja nie dodaje.

```bash
supabase status -o env
# skopiuj DB_URL
SUPABASE_DB_URL='postgresql://...' npm run seed:przyklad
```

Skrypt odmawia, jeśli adres bazy nie jest `127.0.0.1` ani `localhost`.

Konto właściciela: `przyklad.wlasciciel@example.test`  
Konto administratora: `przyklad.admin@example.test`  
Hasło obu: `przyklad-lokalne`

Na karcie jest napis „DANE PRZYKŁADOWE”. To nie jest lokal z Zielonej Góry do publikacji w internecie.

## Studio

Panel bazy: adres `STUDIO` z `supabase status`, zwykle [http://127.0.0.1:54323](http://127.0.0.1:54323).
