/**
 * Read deployment environment values without exposing the environment object
 * or logging secrets.
 */
export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function parseBooleanEnv(name: string, defaultValue = false): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined) return defaultValue;

  const value = rawValue.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`${name} must be either true or false when configured.`);
}

export function parseCommaSeparatedEnv(name: string): string[] {
  const value = optionalEnv(name);

  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
