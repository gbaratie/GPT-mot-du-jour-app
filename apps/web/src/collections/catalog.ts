import manifest from "../../../../content/collections.json";
import type { Collection } from "@/lib/api/types";

export const collections: Collection[] = manifest
  .filter((collection) => collection.active)
  .sort((a, b) => a.sort_order - b.sort_order)
  .map(({ slug, name, description, kind, locale, active, sort_order }) => ({
    slug,
    name,
    description,
    kind: kind as Collection["kind"],
    locale,
    active,
    sort_order,
  }));
