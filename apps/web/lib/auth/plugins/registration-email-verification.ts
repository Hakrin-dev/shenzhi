import {
  createAuthEndpoint,
  createAuthMiddleware,
  formCsrfMiddleware,
} from "better-auth/api";
import {
  constantTimeEqual,
  generateRandomString,
  makeSignature,
} from "better-auth/crypto";
import type { BetterAuthPlugin } from "better-auth/types";
import * as z from "zod";

import {
  REGISTRATION_EMAIL_SEND_OTP_PATH,
  REGISTRATION_EMAIL_VERIFY_OTP_PATH,
  REGISTRATION_OTP_ALLOWED_ATTEMPTS,
  REGISTRATION_OTP_EXPIRES_IN_SECONDS,
  REGISTRATION_OTP_LENGTH,
  REGISTRATION_TICKET_EXPIRES_IN_SECONDS,
  REGISTRATION_TICKET_COOKIE,
} from "../registration/constants";

export const REGISTRATION_EMAIL_ERROR_CODES = {
  INVALID_OTP: "INVALID_OTP",
  OTP_EXPIRED: "OTP_EXPIRED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  EMAIL_NOT_VERIFIED: "REGISTRATION_EMAIL_NOT_VERIFIED",
} as const;

interface RegistrationOtpValue {
  email: string;
  otpHash: string;
  attempts: number;
}

interface RegistrationEmailVerificationOptions {
  sendVerificationOTP: (data: {
    email: string;
    otp: string;
    type: "email-verification";
  }) => Promise<void>;
}

const emailBodySchema = z.object({ email: z.email() });
const verifyBodySchema = emailBodySchema.extend({
  challengeId: z.string().min(16).max(128),
  otp: z.string().regex(/^\d{6}$/),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function challengeIdentifier(challengeId: string) {
  return `registration-email-otp:${challengeId}`;
}

async function ticketIdentifier(ticket: string, secret: string) {
  return `registration-email-ticket:${await makeSignature(ticket, secret)}`;
}

function parseOtpValue(value: string): RegistrationOtpValue | null {
  try {
    const parsed = JSON.parse(value) as Partial<RegistrationOtpValue>;
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.otpHash !== "string" ||
      typeof parsed.attempts !== "number" ||
      !Number.isInteger(parsed.attempts) ||
      parsed.attempts < 0
    ) {
      return null;
    }
    return parsed as RegistrationOtpValue;
  } catch {
    return null;
  }
}

/**
 * A staged registration plugin: prove mailbox ownership first, then permit
 * Better Auth's normal password sign-up exactly once with a short-lived ticket.
 */
export function registrationEmailVerification(
  options: RegistrationEmailVerificationOptions,
) {
  return {
    id: "registration-email-verification",
    endpoints: {
      sendRegistrationEmailOtp: createAuthEndpoint(
        REGISTRATION_EMAIL_SEND_OTP_PATH,
        {
          method: "POST",
          body: emailBodySchema,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const otp = generateRandomString(
            REGISTRATION_OTP_LENGTH,
            "0-9",
          );
          const challengeId = generateRandomString(32);
          const identifier = challengeIdentifier(challengeId);
          const otpHash = await makeSignature(
            `${challengeId}:${otp}`,
            ctx.context.secret,
          );

          await ctx.context.internalAdapter.createVerificationValue({
            identifier,
            value: JSON.stringify({ email, otpHash, attempts: 0 }),
            expiresAt: new Date(
              Date.now() + REGISTRATION_OTP_EXPIRES_IN_SECONDS * 1000,
            ),
          });

          try {
            await options.sendVerificationOTP({
              email,
              otp,
              type: "email-verification",
            });
          } catch (error) {
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(
              identifier,
            );
            throw error;
          }

          return ctx.json({ success: true, challengeId });
        },
      ),
      verifyRegistrationEmailOtp: createAuthEndpoint(
        REGISTRATION_EMAIL_VERIFY_OTP_PATH,
        {
          method: "POST",
          body: verifyBodySchema,
          use: [formCsrfMiddleware],
        },
        async (ctx) => {
          const email = normalizeEmail(ctx.body.email);
          const identifier = challengeIdentifier(ctx.body.challengeId);
          const existing =
            await ctx.context.internalAdapter.findVerificationValue(identifier);

          if (existing && existing.expiresAt < new Date()) {
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(
              identifier,
            );
            return ctx.error("BAD_REQUEST", {
              code: REGISTRATION_EMAIL_ERROR_CODES.OTP_EXPIRED,
              message: "Registration OTP expired",
            });
          }

          const consumed =
            await ctx.context.internalAdapter.consumeVerificationValue(
              identifier,
            );
          if (!consumed) {
            return ctx.error("BAD_REQUEST", {
              code: REGISTRATION_EMAIL_ERROR_CODES.INVALID_OTP,
              message: "Invalid registration OTP",
            });
          }

          if (consumed.expiresAt < new Date()) {
            return ctx.error("BAD_REQUEST", {
              code: REGISTRATION_EMAIL_ERROR_CODES.OTP_EXPIRED,
              message: "Registration OTP expired",
            });
          }

          const stored = parseOtpValue(consumed.value);
          if (!stored || stored.email !== email) {
            return ctx.error("BAD_REQUEST", {
              code: REGISTRATION_EMAIL_ERROR_CODES.INVALID_OTP,
              message: "Invalid registration OTP",
            });
          }

          if (stored.attempts >= REGISTRATION_OTP_ALLOWED_ATTEMPTS) {
            return ctx.error("FORBIDDEN", {
              code: REGISTRATION_EMAIL_ERROR_CODES.TOO_MANY_ATTEMPTS,
              message: "Too many registration OTP attempts",
            });
          }

          const candidateHash = await makeSignature(
            `${ctx.body.challengeId}:${ctx.body.otp}`,
            ctx.context.secret,
          );
          if (!constantTimeEqual(candidateHash, stored.otpHash)) {
            await ctx.context.internalAdapter.createVerificationValue({
              identifier,
              value: JSON.stringify({
                ...stored,
                attempts: stored.attempts + 1,
              }),
              expiresAt: consumed.expiresAt,
            });
            return ctx.error("BAD_REQUEST", {
              code: REGISTRATION_EMAIL_ERROR_CODES.INVALID_OTP,
              message: "Invalid registration OTP",
            });
          }

          if (await ctx.context.internalAdapter.findUserByEmail(email)) {
            return ctx.error("UNPROCESSABLE_ENTITY", {
              code: REGISTRATION_EMAIL_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
              message: "Email is already registered",
            });
          }

          const ticket = generateRandomString(48);
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: await ticketIdentifier(ticket, ctx.context.secret),
            value: email,
            expiresAt: new Date(
              Date.now() + REGISTRATION_TICKET_EXPIRES_IN_SECONDS * 1000,
            ),
          });

          const ticketCookie = ctx.context.createAuthCookie(
            REGISTRATION_TICKET_COOKIE,
            {
              httpOnly: true,
              maxAge: REGISTRATION_TICKET_EXPIRES_IN_SECONDS,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            },
          );
          await ctx.setSignedCookie(
            ticketCookie.name,
            ticket,
            ctx.context.secret,
            ticketCookie.attributes,
          );

          return ctx.json({ success: true });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher: (context) => context.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const email = normalizeEmail(String(ctx.body?.email ?? ""));
            const ticketCookie = ctx.context.createAuthCookie(
              REGISTRATION_TICKET_COOKIE,
            );
            const ticket = await ctx.getSignedCookie(
              ticketCookie.name,
              ctx.context.secret,
            );
            if (!ticket) {
              return ctx.error("FORBIDDEN", {
                code: REGISTRATION_EMAIL_ERROR_CODES.EMAIL_NOT_VERIFIED,
                message: "Registration email has not been verified",
              });
            }

            const verification =
              await ctx.context.internalAdapter.findVerificationValue(
                await ticketIdentifier(ticket, ctx.context.secret),
              );
            if (
              !verification ||
              verification.expiresAt < new Date() ||
              verification.value !== email
            ) {
              return ctx.error("FORBIDDEN", {
                code: REGISTRATION_EMAIL_ERROR_CODES.EMAIL_NOT_VERIFIED,
                message: "Registration email verification expired",
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (context) => context.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const ticketCookie = ctx.context.createAuthCookie(
              REGISTRATION_TICKET_COOKIE,
            );
            ctx.setCookie(ticketCookie.name, "", {
              ...ticketCookie.attributes,
              maxAge: 0,
            });
          }),
        },
      ],
    },
    init() {
      return {
        options: {
          databaseHooks: {
            user: {
              create: {
                async before(user, context) {
                  if (context?.path !== "/sign-up/email") return;

                  const ticketCookie = context.context.createAuthCookie(
                    REGISTRATION_TICKET_COOKIE,
                  );
                  const ticket = await context.getSignedCookie(
                    ticketCookie.name,
                    context.context.secret,
                  );
                  if (!ticket) {
                    throw context.error("FORBIDDEN", {
                      code: REGISTRATION_EMAIL_ERROR_CODES.EMAIL_NOT_VERIFIED,
                      message: "Registration email has not been verified",
                    });
                  }

                  const verification =
                    await context.context.internalAdapter.consumeVerificationValue(
                      await ticketIdentifier(
                        ticket,
                        context.context.secret,
                      ),
                    );
                  if (
                    !verification ||
                    verification.expiresAt < new Date() ||
                    verification.value !== normalizeEmail(user.email)
                  ) {
                    throw context.error("FORBIDDEN", {
                      code: REGISTRATION_EMAIL_ERROR_CODES.EMAIL_NOT_VERIFIED,
                      message: "Registration email verification expired",
                    });
                  }

                  return { data: { ...user, emailVerified: true } };
                },
              },
            },
          },
        },
      };
    },
    rateLimit: [
      {
        pathMatcher: (path) => path === REGISTRATION_EMAIL_SEND_OTP_PATH,
        window: 60,
        max: 3,
      },
      {
        pathMatcher: (path) => path === REGISTRATION_EMAIL_VERIFY_OTP_PATH,
        window: 60,
        max: 5,
      },
    ],
  } satisfies BetterAuthPlugin;
}
