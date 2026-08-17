import { AppShell } from "@/components/layout/app-shell";
import { SubmitBrowser } from "@/features/submit/components/submit-browser";

/** 投稿 · 期刊 `/submit/journals` */
export function JournalsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] px-8 py-6">
        <SubmitBrowser kind="journal" />
      </div>
    </AppShell>
  );
}
