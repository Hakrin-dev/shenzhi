import { KnowledgeSearchPage } from "@/features/knowledge/search/KnowledgeSearchPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return <KnowledgeSearchPage initialQuery={q} />;
}
