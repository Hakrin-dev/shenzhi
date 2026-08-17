import { z } from "zod";

/** 搜索表单校验 schema,待搜索表单组件接入时复用 */
export const searchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "请输入搜索内容")
    .max(2000, "请输入 2000 字以内的问题"),
});

export const questionSchema = z
  .string()
  .trim()
  .min(1, "请输入 2000 字以内的问题")
  .max(2000, "请输入 2000 字以内的问题");

export type SearchFormValues = z.infer<typeof searchSchema>;
