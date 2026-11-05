import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page introuvable</h1>
      <Link href="/">Retour à l’accueil</Link>
    </>
  );
}
