import { KnowledgeRelationGraphPage } from "@/features/knowledge/graph/KnowledgeRelationGraphPage";

export default async function Page({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  return <KnowledgeRelationGraphPage paperId={decodeURIComponent(paperId)} />;
}
