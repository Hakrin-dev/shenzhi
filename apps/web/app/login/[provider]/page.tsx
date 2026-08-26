import { OAuthVerifyPage } from "@/features/login/OAuthVerifyPage";

export default async function Page({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;
  return <OAuthVerifyPage provider={provider} />;
}
