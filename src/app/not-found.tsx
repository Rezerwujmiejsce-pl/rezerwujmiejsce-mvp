import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap page-pad">
      <h1 className="disp">Nie ma takiej strony</h1>
      <p>Lokal mógł nie zostać opublikowany albo adres jest zły.</p>
      <p><Link href="/sale">Wróć do wyszukiwania</Link></p>
    </main>
  );
}
