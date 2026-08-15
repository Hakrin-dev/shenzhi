export type PasswordCompositionRule = "uppercase" | "lowercase" | "digit";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 64;

export interface PasswordCompositionResult {
  valid: boolean;
  missing: PasswordCompositionRule[];
}

export interface PasswordPolicyResult extends PasswordCompositionResult {
  lengthValid: boolean;
}

/**
 * Product-level password composition rules.
 * Length, hashing, verification, and storage remain Better Auth concerns.
 */
export function validatePasswordComposition(
  password: string,
): PasswordCompositionResult {
  const missing: PasswordCompositionRule[] = [];

  if (!/[A-Z]/.test(password)) missing.push("uppercase");
  if (!/[a-z]/.test(password)) missing.push("lowercase");
  if (!/[0-9]/.test(password)) missing.push("digit");

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Full product password admission policy. Better Auth remains the final
 * authority for enforcing length, hashing, verification, and storage.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const composition = validatePasswordComposition(password);
  const lengthValid =
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH;

  return {
    ...composition,
    lengthValid,
    valid: lengthValid && composition.valid,
  };
}
