import type { FeedPaper, Scholar } from "@/types";
import { feedPapers } from "./papers";
import { agentReferences } from "./agent";
import { scholars } from "./scholars";

const extraSearchPapers: FeedPaper[] = [
  {
    id: "diffusion-policy",
    date: "2023-03-10",
    venue: "RSS 2023",
    venueTone: "violet",
    authors: "Cheng Chi · Siyuan Feng · et al. (Columbia)",
    title: "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion",
    abstract:
      "Diffusion Policy 将机器人视觉运动策略建模为条件去噪扩散过程,在接触丰富的操作任务上显著优于隐式行为克隆与能量模型基线。",
    aiLink: "AI 深度解读",
    tags: ["Diffusion Policy", "机器人策略", "扩散模型", "模仿学习"],
    likes: 892,
    citations: 2104,
    thumb: "策略扩散示意",
  },
  {
    id: "dp3",
    date: "2024-03-18",
    venue: "RSS 2024",
    venueTone: "amber",
    authors: "Yanjie Ze · Gu Zhang · et al.",
    title:
      "3D Diffusion Policy: Generalizable Visuomotor Policy Learning via Simple 3D Representations",
    abstract:
      "DP3 用点云等紧凑三维表征条件化 Diffusion Policy,在真实机器人上提升泛化能力。",
    aiLink: "查看解读",
    tags: ["DP3", "Diffusion Policy", "3D", "操作泛化"],
    likes: 341,
    citations: 486,
    thumb: "三维策略架构图",
  },
];

const referencePapers: FeedPaper[] = agentReferences.map((ref) => ({
  id: `ref-${ref.id}`,
  date: "2026-01-15",
  venue: ref.venue,
  venueTone: ref.tone === "gray" ? "amber" : ref.tone,
  authors: ref.author,
  title: ref.title,
  abstract: `${ref.title}。演示引用 [${ref.id}]，${ref.citations}。`,
  aiLink: "AI 深度解读",
  tags: ["Diffusion Policy", "机器人", "引用"],
  likes: 40 + ref.id * 17,
  citations: Number.parseInt(ref.citations.replace(/\D/g, ""), 10) || 0,
  thumb: "引用论文",
}));

export const searchPapers: FeedPaper[] = [
  ...extraSearchPapers,
  ...referencePapers,
  ...feedPapers,
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchAllTokens(haystack: string, query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  const hay = normalize(haystack);
  return q.split(" ").filter(Boolean).every((token) => hay.includes(token));
}

export function searchLocalPapers(query: string): FeedPaper[] {
  if (!query.trim()) return [];
  const seen = new Set<string>();
  return searchPapers.filter((paper) => {
    if (seen.has(paper.title)) return false;
    const hit = matchAllTokens(
      [paper.title, paper.abstract, paper.authors, paper.venue, ...paper.tags].join(" "),
      query,
    );
    if (hit) seen.add(paper.title);
    return hit;
  });
}

export function searchLocalScholars(query: string): Scholar[] {
  if (!query.trim()) return scholars.slice(0, 4);
  const hits = scholars.filter((s) =>
    matchAllTokens(
      [s.nameCn, s.nameEn, s.affiliation, s.bio, ...s.tags].join(" "),
      query,
    ),
  );
  return hits.length > 0 ? hits.slice(0, 8) : scholars.slice(0, 4);
}
