import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;

  const query = q.trim();
  redirect(query ? `/knowledge/search?q=${encodeURIComponent(query)}` : "/knowledge/search");
}
