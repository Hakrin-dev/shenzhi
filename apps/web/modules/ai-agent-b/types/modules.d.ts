/**
 * types/modules.d.ts — 为未提供 types 的第三方包提供最小声明
 * ------------------------------------------------------------------
 * bcryptjs@2.4.3：npm 发布包本身未包含 .d.ts；
 *   @types/bcryptjs@3.x 是 stub（提示安装者 bcryptjs 自带类型——实际上 2.x 并没带）。
 * 这里手动写最小可用声明，避免 Build TS Error:
 *   "Could not find a declaration file for module 'bcryptjs'."
 */

declare module "bcryptjs" {
  export function hash(
    s: string,
    saltOrRounds: string | number,
  ): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(s: string, saltOrRounds: string | number): string;
  export function compareSync(s: string, hash: string): boolean;
  export function genSaltSync(rounds?: number): string;
}
