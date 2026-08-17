const EMAIL_DELIVERY_PATHS = new Set([
  "/send-verification-email",
  "/request-password-reset",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/request-email-change",
]);

export function requiresEmailDelivery(
  path: string,
  requireEmailVerification: boolean,
): boolean {
  return (
    EMAIL_DELIVERY_PATHS.has(path) ||
    (requireEmailVerification && path === "/sign-up/email")
  );
}
