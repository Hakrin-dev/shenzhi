import { ArrowRight } from "lucide-react";
import { followUps } from "@/lib/data/agent";

/** 继续深入研究 —— 追问建议 chips */
export function FollowUps() {
  return (
    <section className="w-full">
      <p className="text-xs text-faint">继续深入研究</p>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {followUps.map((question) => (
          <button
            key={question}
            type="button"
            className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-2.5 text-left text-[14px] text-ink-2 transition-colors hover:border-primary hover:text-primary"
          >
            <span className="flex-1">{question}</span>
            <ArrowRight className="size-4 shrink-0 text-faint" />
          </button>
        ))}
      </div>
    </section>
  );
}
