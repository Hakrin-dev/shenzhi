import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/features/search/components/search-hero";
import { SearchResults } from "@/features/search/components/search-results";

export function SearchPage({ query }: { query: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 px-8 py-6">
        <SearchHero key={query} initialQuery={query} initialMode="search" />
        <SearchResults query={query} />
      </div>
    </AppShell>
  );
}
