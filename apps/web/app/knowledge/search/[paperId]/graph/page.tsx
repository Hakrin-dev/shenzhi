import { KnowledgeRelationGraphPage } from "@/features/knowledge/graph/KnowledgeRelationGraphPage";
import { decodeKnowledgePaperRouteId } from "../../route-id";

export default async function Page({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  return <KnowledgeRelationGraphPage paperId={decodeKnowledgePaperRouteId(paperId)} />;
}
