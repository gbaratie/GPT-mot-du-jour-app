export type CollectionKind = "word" | "quote" | "riddle";

export interface Collection {
  slug: string;
  name: string;
  description: string;
  kind: CollectionKind;
  locale: string;
  active: boolean;
  sort_order: number;
}

interface EntryBase {
  collection_slug: string;
  publication_date: string;
}

export type DailyEntry = EntryBase &
  (
    | { kind: "word"; payload: { term: string; definition: string; example: string } }
    | { kind: "quote"; payload: { text: string; author: string; source: string | null } }
    | { kind: "riddle"; payload: { question: string; answer: string; hint: string | null } }
  );

export interface TodayResponse {
  date: string;
  items: { collection: Collection; entry: DailyEntry | null }[];
}
