import { z } from "zod";

/**
 * UPDATE: 2026-08-18 A+B 单前端整合
 *   1) questionSchema：B 原 validations.ts 缺失此导出，A 的 composer.tsx 通过 `import { questionSchema } from "@/lib/validations"` 引用
 *   2) 最大字数统一扩展至 2000 字（B 旧版 500），与 A 表单约束对齐
 * 修改日志：任务日志/对于A的修改/2026.8.18-A+B整合单前端化修改.md
 */

/** 搜索表单校验 —— React Hook Form 配合 zodResolver 使用 */
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "请输入搜索内容")
    .max(2000, "请输入 2000 字以内的问题"),
});

/**
 * UPDATE: 2026-08-18 A+B 单前端整合
 *   新增 questionSchema —— 供 components/features/agent/composer.tsx 做 ComposerShell 提交前校验
 *   值域：非空 + 2000 字
 */
export const questionSchema = z
  .string()
  .trim()
  .min(1, "请输入 2000 字以内的问题")
  .max(2000, "请输入 2000 字以内的问题");

export type SearchFormValues = z.infer<typeof searchSchema>;
