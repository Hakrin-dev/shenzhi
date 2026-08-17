import { AppShell } from "@/components/layout/app-shell";
import { InstitutionsBrowser } from "@/features/knowledge/institutions/components/institutions-browser";

/** 研究机构 `/knowledge/institutions` —— 单列大卡片,参考学者关系页 */
export function InstitutionsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[960px] px-8 py-6">
        <InstitutionsBrowser />
      </div>
    </AppShell>
  );
}
