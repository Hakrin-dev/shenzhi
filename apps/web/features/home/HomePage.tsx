"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/features/search/components/search-hero";
import { FeedTabs } from "@/features/search/components/feed-tabs";
import { FeedList } from "@/features/search/components/feed-list";

/** 主发现页 `/` —— 对应「深知-主发现页.svg」 */
export function HomePage() {
  const [searchActive, setSearchActive] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1080px] space-y-5 overflow-visible px-8 py-6">
        <SearchHero onSearchActiveChange={setSearchActive} />
        {!searchActive && (
          <>
            <FeedTabs />
            <FeedList />
          </>
        )}
      </div>
    </AppShell>
  );
}
