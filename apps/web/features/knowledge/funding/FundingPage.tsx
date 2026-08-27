import { AppShell } from "@/components/common/layout/app-shell";
import { FundingBrowser } from "@/features/knowledge/funding/components/funding-browser";

/** 项目基金库 `/knowledge/funding` —— 两栏布局,对齐 `/knowledge` 论文库 */
export function FundingPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <FundingBrowser />
      </div>
    </AppShell>
  );
}
