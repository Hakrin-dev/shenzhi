import { SearchPage } from "@/features/search/SearchPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  return <SearchPage query={q} />;
}
