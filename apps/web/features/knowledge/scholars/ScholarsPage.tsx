import { AppShell } from "@/components/layout/app-shell";
import { ScholarsBrowser } from "@/features/knowledge/scholars/components/scholars-browser";

/** 学者关系 `/knowledge/scholars` —— 对应「深知-学者画像页.svg」(原「研究构想」页) */
export function ScholarsPage() {
  return (
    <AppShell>
      <div className="flex min-h-[calc(100vh)] items-stretch">
        <ScholarsBrowser />
      </div>
    </AppShell>
  );
}
