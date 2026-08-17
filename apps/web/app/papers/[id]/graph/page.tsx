import { PaperGraphPage } from "@/features/papers/[id]/graph/PaperGraphPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PaperGraphPage paperId={id} />;
}
