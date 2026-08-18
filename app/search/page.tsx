import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/components/features/search/search-hero";
import { SearchResults } from "@/components/features/search/search-results";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 px-8 py-6">
        <SearchHero key={q} initialQuery={q} initialMode="search" />
        <SearchResults query={q} />
      </div>
    </AppShell>
  );
}
