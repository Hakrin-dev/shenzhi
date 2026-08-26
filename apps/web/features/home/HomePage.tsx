"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SearchHero } from "@/features/search/components/search-hero";
import { FeedTabs } from "@/features/search/components/feed-tabs";
import { FeedList } from "@/features/search/components/feed-list";

/** 主发现页 `/` */
export function HomePage() {
  const [searchActive, setSearchActive] = useState(false);

  return (
    <AppShell>
      <div className="w-full space-y-5 overflow-visible px-4 py-4 lg:px-5 lg:py-5">
        <SearchHero onSearchActiveChange={setSearchActive} />
        {!searchActive && (
          <div className="space-y-5">
            <FeedTabs />
            <FeedList />
          </div>
        )}
      </div>
    </AppShell>
  );
}
