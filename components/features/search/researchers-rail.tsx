"use client";

import Link from "next/link";
import type { Scholar } from "@/types";

export function ResearchersRail({ scholars }: { scholars: Scholar[] }) {
  if (scholars.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">相关学者</h2>
        <Link
          href="/knowledge/scholars"
          className="text-[13px] text-muted transition-colors hover:text-primary"
        >
          查看全部
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {scholars.map((scholar) => (
          <Link
            key={scholar.id}
            href={`/scholars/${scholar.id}`}
            className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-chip"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: scholar.avatarColor }}
            >
              {scholar.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {scholar.nameCn}
                <span className="ml-1.5 font-normal text-muted">{scholar.nameEn}</span>
              </span>
              <span className="mt-0.5 line-clamp-1 block text-[12px] text-faint">
                {scholar.affiliation}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
