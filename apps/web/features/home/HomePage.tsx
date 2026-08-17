import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/features/search/components/search-hero";
import { FeedTabs } from "@/features/search/components/feed-tabs";
import { FeedList } from "@/features/search/components/feed-list";

/** 主发现页 `/` —— 对应「深知-主发现页.svg」 */
export function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 px-8 py-6">
        <SearchHero />
        <FeedTabs />
        <FeedList />
      </div>
    </AppShell>
  );
}
