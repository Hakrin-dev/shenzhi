import { KnowledgePaperDetailPage } from "@/features/knowledge/paper/KnowledgePaperDetailPage";
import { decodeKnowledgePaperRouteId } from "../route-id";

export default async function Page({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  return <KnowledgePaperDetailPage paperId={decodeKnowledgePaperRouteId(paperId)} />;
}
