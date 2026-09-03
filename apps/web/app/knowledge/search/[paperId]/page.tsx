import { KnowledgePaperDetailPage } from "@/features/knowledge/paper/KnowledgePaperDetailPage";
import { normalizeInternalReturnTo } from "@/lib/navigation/internal-return-to";
import { decodeKnowledgePaperRouteId } from "../route-id";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ paperId: string }>;
  searchParams?: Promise<{ returnTo?: string | string[] }>;
}) {
  const { paperId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const returnTo = typeof query?.returnTo === "string"
    ? normalizeInternalReturnTo(query.returnTo)
    : null;
  return (
    <KnowledgePaperDetailPage
      paperId={decodeKnowledgePaperRouteId(paperId)}
      returnTo={returnTo}
    />
  );
}
