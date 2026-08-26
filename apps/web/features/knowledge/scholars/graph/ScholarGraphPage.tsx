import { AppShell } from "@/components/common/layout/app-shell";
import { ScholarNetwork } from "@/features/knowledge/scholars/graph/components/scholar-network";

/** 学者合作关系图谱示例 —— 与私域论文图谱完全独立 */
export function ScholarGraphPage() {
  return (
    <AppShell>
      <ScholarNetwork />
    </AppShell>
  );
}
