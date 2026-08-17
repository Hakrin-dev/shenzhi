import { ScholarDetailPage } from "@/features/scholars/[id]/ScholarDetailPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ScholarDetailPage scholarId={id} />;
}
