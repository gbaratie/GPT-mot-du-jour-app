import { Suspense } from "react";
import { notFound } from "next/navigation";
import { collections } from "@/collections/catalog";
import CollectionPage from "@/components/CollectionPage";

export const dynamicParams = false;

export function generateStaticParams() {
  return collections.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = collections.find((collection) => collection.slug === slug);
  return { title: collection?.name, description: collection?.description };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = collections.find((collection) => collection.slug === slug);
  if (!collection) notFound();
  return (
    <Suspense fallback={<p role="status">Chargement…</p>}>
      <CollectionPage collection={collection} />
    </Suspense>
  );
}
