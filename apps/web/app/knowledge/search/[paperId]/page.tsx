import { KnowledgePaperDetailPage } from "@/features/knowledge/paper/KnowledgePaperDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  return <KnowledgePaperDetailPage paperId={decodeURIComponent(paperId)} />;
}
