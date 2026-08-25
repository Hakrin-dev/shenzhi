/** 科研项目 mock 数据 —— 项目由用户自己建立;样例「深知」取自仓库 README */

export type MilestoneStatus = "done" | "doing" | "todo";

export interface Milestone {
  title: string;
  detail: string;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  status: "进行中" | "已完成" | "已搁置";
  progress: number;
  createdAt: string;
  owner: string;
  overview: string[];
  techStack: string[];
  milestones: Milestone[];
  members: { name: string; role: string }[];
  links: { label: string; href: string }[];
}

export const projects: Project[] = [
  {
    id: "shenzhi",
    name: "深知",
    tagline: "ShenZhi · Research OS —— 面向 AI 领域学术科研的专业可信知识智能体服务平台",
    status: "进行中",
    progress: 68,
    createdAt: "2025-11-02",
    owner: "项目团队",
    overview: [
      "深知提供论文检索、投稿筛选,以及用于 Deep Research 与 Auto Research 的知识智能体服务。前端为 prototype_v1 SVG 原型的正式 React 实现,9 个页面已全部完成转换,并落地了品牌体系与日/夜模式。",
      "可部署至云服务器,日常迭代只需 git push:GitHub Actions 完成 Docker 构建、推送镜像仓库、安全扫描并自动上线。",
    ],
    techStack: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Tailwind CSS 4",
      "TanStack Query",
      "Zustand",
      "Framer Motion",
      "Docker",
    ],
    milestones: [
      {
        title: "原型页面转换",
        detail: "7 张 SVG 原型 + 2 个知识图谱页,9 个路由全部完成",
        status: "done",
      },
      {
        title: "品牌体系落地",
        detail: "书法 Logo 日/夜双版 + 「深识」配色令牌,日夜间模式",
        status: "done",
      },
      {
        title: "部署上线",
        detail: "阿里云 ECS + GitHub Actions CI/CD,push 即发布",
        status: "done",
      },
      {
        title: "设置与用户体系界面",
        detail: "设置页七 Tab、登录弹窗、个人学者画像(演示态)",
        status: "doing",
      },
      {
        title: "接入真实数据层",
        detail: "Server Actions + 数据库替换 mock;认证(NextAuth)",
        status: "todo",
      },
      {
        title: "编辑器与可视化",
        detail: "TipTap 文档编辑、D3.js 图谱交互增强",
        status: "todo",
      },
    ],
    members: [
      { name: "团队负责人", role: "负责人" },
      { name: "前端开发", role: "前端" },
      { name: "算法工程师", role: "算法" },
    ],
    links: [
      { label: "线上地址", href: "https://example.com" },
      { label: "GitHub 仓库", href: "https://github.com/your-org/shenzhi" },
      { label: "GHCR 镜像", href: "https://ghcr.io/your-org/shenzhi-frontend" },
    ],
  },
];

export function getProject(id: string): Project {
  return projects.find((p) => p.id === id) ?? projects[0];
}
