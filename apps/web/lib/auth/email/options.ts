import type { EmailOTPOptions } from "better-auth/plugins";

/** Better Auth Email OTP settings shared by runtime configuration and tests. */
export const EMAIL_OTP_OPTIONS = {
  otpLength: 6,
  expiresIn: 300,
  allowedAttempts: 3,
  // Email OTP is a sign-in method only. Password sign-up remains the sole
  // account-creation path.
  disableSignUp: true,
  rateLimit: {
    window: 60,
    max: 3,
  },
  storeOTP: "hashed",
} satisfies Omit<EmailOTPOptions, "sendVerificationOTP">;
