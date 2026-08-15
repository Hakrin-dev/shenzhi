import { z } from "zod";

/** 搜索表单校验 schema,待搜索表单组件接入时复用 */
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "请输入搜索内容")
    .max(200, "搜索内容过长"),
});

export type SearchFormValues = z.infer<typeof searchSchema>;
