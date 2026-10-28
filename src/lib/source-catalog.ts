export const SOURCE_CATALOG = {
  strmfree: { name: "StrmFree", url: "https://strmfree.st" },
  tim: { name: "Timst", url: "https://timst.top" },
  pit: { name: "PitSport", url: "https://pitsport.st" },
  daddy: { name: "Daddy", url: "https://thedaddy.pk" },
  ppv: { name: "PPV", url: "https://ppv.st" },
} as const;

export type SourceCode = keyof typeof SOURCE_CATALOG;
export const ALTERNATE_CODES = ["tim", "pit", "daddy", "ppv"] as const;
export function sourceCode(value: unknown): SourceCode {
  return typeof value === "string" && Object.hasOwn(SOURCE_CATALOG, value)
    ? value as SourceCode : "strmfree";
}
export function searchCode(value: string): SourceCode | undefined {
  const normalized = value.trim().toLowerCase();
  return ALTERNATE_CODES.find((code) => code === normalized);
}
export function matchesSearch(match: { title: string; category: string; teams?: { home?: { name: string } | null; away?: { name: string } | null } | null }, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = [match.title, match.category, match.teams?.home?.name, match.teams?.away?.name].filter(Boolean).join(" ").toLowerCase();
  return terms.every((term) => text.includes(term));
}