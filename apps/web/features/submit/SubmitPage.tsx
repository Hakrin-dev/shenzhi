import { AppShell } from "@/components/common/layout/app-shell";
import { SubmitBrowser } from "@/features/submit/components/submit-browser";

/** 投稿 · 会议 `/submit` —— 对应「深知-投稿详情页.svg」,点击侧边栏「投稿」默认打开 */
export function SubmitPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitBrowser kind="conference" />
      </div>
    </AppShell>
  );
}
