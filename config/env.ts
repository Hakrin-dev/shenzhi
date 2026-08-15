/**
 * Read deployment environment values without exposing the environment object
 * or logging secrets.
 */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function parseCommaSeparatedEnv(name: string): string[] {
  const value = optionalEnv(name);

  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
