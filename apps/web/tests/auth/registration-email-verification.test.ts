import assert from "node:assert/strict";
import test from "node:test";

import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";

import { registrationEmailVerification } from "../../lib/auth/plugins/registration-email-verification.js";

const BASE_URL = "http://localhost:3000";
const TEST_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
const TEST_PASSWORD = "Password12345";

function jsonRequest(path: string, body: Record<string, string>, cookie?: string) {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createRegistrationAuth(options?: { failDelivery?: boolean }) {
  const database: Record<string, Array<Record<string, unknown>>> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const sentOtps: Array<{ email: string; otp: string }> = [];
  const auth = betterAuth({
    secret: TEST_SECRET,
    baseURL: BASE_URL,
    database: memoryAdapter(database),
    logger: { disabled: true },
    emailVerification: { sendOnSignUp: false },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 64,
    },
    plugins: [
      registrationEmailVerification({
        async sendVerificationOTP({ email, otp }) {
          if (options?.failDelivery) throw new Error("delivery failed");
          sentOtps.push({ email, otp });
        },
      }),
    ],
  });

  return { auth, database, sentOtps };
}

test("registration verifies email before creating the Better Auth user", async () => {
  const { auth, database, sentOtps } = createRegistrationAuth();
  const email = "new-user@example.com";

  const sendResponse = await auth.handler(
    jsonRequest("/registration-email/send-otp", { email }),
  );
  const sendResult = (await sendResponse.json()) as { challengeId: string };

  assert.equal(sendResponse.status, 200);
  assert.match(sendResult.challengeId, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(sentOtps.length, 1);
  assert.equal(database.user.length, 0);

  const wrongResponse = await auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email,
      challengeId: sendResult.challengeId,
      otp: "000000",
    }),
  );
  const wrongResult = (await wrongResponse.json()) as { code: string };
  assert.equal(wrongResponse.status, 400);
  assert.equal(wrongResult.code, "INVALID_OTP");
  assert.equal(database.user.length, 0);

  const verifyResponse = await auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email,
      challengeId: sendResult.challengeId,
      otp: sentOtps[0].otp,
    }),
  );
  const ticketCookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];

  assert.equal(verifyResponse.status, 200);
  assert.ok(ticketCookie);
  assert.match(ticketCookie, /registration_ticket/);
  assert.match(verifyResponse.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(verifyResponse.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
  assert.equal(database.user.length, 0);
  assert.equal(database.account.length, 0);
  assert.equal(database.session.length, 0);

  const unverifiedSignUp = await auth.handler(
    jsonRequest("/sign-up/email", {
      email: "bypass@example.com",
      name: "绕过验证",
      password: TEST_PASSWORD,
    }),
  );
  assert.equal(unverifiedSignUp.status, 403);
  assert.equal(database.user.length, 0);

  const signUpResponse = await auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email, name: "测试用户", password: TEST_PASSWORD },
      ticketCookie,
    ),
  );
  const signUpResult = (await signUpResponse.json()) as {
    token: string | null;
    user: { emailVerified: boolean };
  };

  assert.equal(signUpResponse.status, 200);
  assert.match(signUpResponse.headers.get("set-cookie") ?? "", /registration_ticket/i);
  assert.match(signUpResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  assert.equal(signUpResult.token, null);
  assert.equal(signUpResult.user.emailVerified, true);
  assert.equal(database.user.length, 1);
  assert.equal(database.account.length, 1);
  assert.equal(database.session.length, 0);

  const replayResponse = await auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email, name: "重复提交", password: TEST_PASSWORD },
      ticketCookie,
    ),
  );
  assert.equal(replayResponse.status, 403);
  assert.equal(database.user.length, 1);

  const signInResponse = await auth.handler(
    jsonRequest("/sign-in/email", { email, password: TEST_PASSWORD }),
  );
  assert.equal(signInResponse.status, 200);
  assert.equal(database.session.length, 1);
});

test("registration tickets stay bound to the verified email and expire", async () => {
  const bound = createRegistrationAuth();
  const email = "bound-ticket@example.com";
  const sendResponse = await bound.auth.handler(
    jsonRequest("/registration-email/send-otp", { email }),
  );
  const { challengeId } = (await sendResponse.json()) as {
    challengeId: string;
  };
  const verifyResponse = await bound.auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email,
      challengeId,
      otp: bound.sentOtps[0].otp,
    }),
  );
  const ticketCookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(ticketCookie);

  const mismatchedResponse = await bound.auth.handler(
    jsonRequest(
      "/sign-up/email",
      {
        email: "different@example.com",
        name: "错误邮箱",
        password: TEST_PASSWORD,
      },
      ticketCookie,
    ),
  );
  assert.equal(mismatchedResponse.status, 403);
  assert.equal(bound.database.user.length, 0);

  const correctResponse = await bound.auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email, name: "正确邮箱", password: TEST_PASSWORD },
      ticketCookie,
    ),
  );
  assert.equal(correctResponse.status, 200);
  assert.equal(bound.database.user.length, 1);

  const expired = createRegistrationAuth();
  const expiredEmail = "expired-ticket@example.com";
  const expiredSendResponse = await expired.auth.handler(
    jsonRequest("/registration-email/send-otp", { email: expiredEmail }),
  );
  const expiredChallenge = (await expiredSendResponse.json()) as {
    challengeId: string;
  };
  const expiredVerifyResponse = await expired.auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email: expiredEmail,
      challengeId: expiredChallenge.challengeId,
      otp: expired.sentOtps[0].otp,
    }),
  );
  const expiredTicketCookie = expiredVerifyResponse.headers
    .get("set-cookie")
    ?.split(";")[0];
  assert.ok(expiredTicketCookie);
  const ticketRecord = expired.database.verification.find((record) =>
    String(record.identifier).startsWith("registration-email-ticket:"),
  );
  assert.ok(ticketRecord);
  ticketRecord.expiresAt = new Date(Date.now() - 1_000);

  const expiredSignUpResponse = await expired.auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email: expiredEmail, name: "过期资格", password: TEST_PASSWORD },
      expiredTicketCookie,
    ),
  );
  assert.equal(expiredSignUpResponse.status, 403);
  assert.equal(expired.database.user.length, 0);
});

test("a failed password submission does not burn the verified-email ticket", async () => {
  const { auth, database, sentOtps } = createRegistrationAuth();
  const email = "retry@example.com";
  const sendResponse = await auth.handler(
    jsonRequest("/registration-email/send-otp", { email }),
  );
  const { challengeId } = (await sendResponse.json()) as {
    challengeId: string;
  };
  const verifyResponse = await auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email,
      challengeId,
      otp: sentOtps[0].otp,
    }),
  );
  const ticketCookie = verifyResponse.headers.get("set-cookie")?.split(";")[0];
  assert.ok(ticketCookie);

  const invalidResponse = await auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email, name: "测试用户", password: "Short1A" },
      ticketCookie,
    ),
  );
  assert.equal(invalidResponse.status, 400);
  assert.equal(database.user.length, 0);

  const retryResponse = await auth.handler(
    jsonRequest(
      "/sign-up/email",
      { email, name: "测试用户", password: TEST_PASSWORD },
      ticketCookie,
    ),
  );
  assert.equal(retryResponse.status, 200);
  assert.equal(database.user.length, 1);
  assert.equal(database.account.length, 1);
});

test("registration OTP expiry and attempt limits fail without creating users", async () => {
  const expired = createRegistrationAuth();
  const expiredEmail = "expired-registration@example.com";
  const expiredSend = await expired.auth.handler(
    jsonRequest("/registration-email/send-otp", { email: expiredEmail }),
  );
  const expiredChallenge = (await expiredSend.json()) as {
    challengeId: string;
  };
  const expiredRecord = expired.database.verification.find(
    (record) => record.identifier === `registration-email-otp:${expiredChallenge.challengeId}`,
  );
  assert.ok(expiredRecord);
  expiredRecord.expiresAt = new Date(Date.now() - 1_000);

  const expiredResponse = await expired.auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email: expiredEmail,
      challengeId: expiredChallenge.challengeId,
      otp: expired.sentOtps[0].otp,
    }),
  );
  const expiredResult = (await expiredResponse.json()) as { code: string };
  assert.equal(expiredResponse.status, 400);
  assert.equal(expiredResult.code, "OTP_EXPIRED");
  assert.equal(expired.database.user.length, 0);

  const limited = createRegistrationAuth();
  const limitedEmail = "limited-registration@example.com";
  const limitedSend = await limited.auth.handler(
    jsonRequest("/registration-email/send-otp", { email: limitedEmail }),
  );
  const limitedChallenge = (await limitedSend.json()) as {
    challengeId: string;
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await limited.auth.handler(
      jsonRequest("/registration-email/verify-otp", {
        email: limitedEmail,
        challengeId: limitedChallenge.challengeId,
        otp: "000000",
      }),
    );
    assert.equal(response.status, 400);
  }
  const lockedResponse = await limited.auth.handler(
    jsonRequest("/registration-email/verify-otp", {
      email: limitedEmail,
      challengeId: limitedChallenge.challengeId,
      otp: limited.sentOtps[0].otp,
    }),
  );
  const lockedResult = (await lockedResponse.json()) as { code: string };
  assert.equal(lockedResponse.status, 403);
  assert.equal(lockedResult.code, "TOO_MANY_ATTEMPTS");
  assert.equal(limited.database.user.length, 0);
});

test("failed email delivery removes the unusable registration challenge", async () => {
  const { auth, database } = createRegistrationAuth({ failDelivery: true });
  const response = await auth.handler(
    jsonRequest("/registration-email/send-otp", {
      email: "delivery-failure@example.com",
    }),
  );

  assert.equal(response.status, 500);
  assert.equal(database.verification.length, 0);
  assert.equal(database.user.length, 0);
});
